import generatePayload from 'promptpay-qr'
import QRCode from 'qrcode'
import { all, one, insert, update, uid, audit, tx, now, r2, getSetting, nextCounter, beYear } from '../db'
import { requireUser, requirePerm, approve, can, SessionUser } from '../auth'
import { depositBalance, recordVaccination } from './clinic'

type Method = 'cash' | 'transfer' | 'promptpay' | 'card' | 'deposit'
interface PayIn {
  method: Method
  amount: number
}
interface Approval {
  username: string
  pin: string
}

const METHODS: Method[] = ['cash', 'transfer', 'promptpay', 'card', 'deposit']

/* ---------------- shifts ---------------- */

function openShift(): any {
  return one("SELECT * FROM shifts WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1")
}

function requireOpenShift(): any {
  const s = openShift()
  if (!s) throw new Error('ยังไม่ได้เปิดกะ — กรุณาเปิดกะก่อนรับเงิน')
  return s
}

function shiftSummary(shiftId: string): any {
  const s = one<any>(
    `SELECT s.*, uo.display_name AS opened_by_name, uc.display_name AS closed_by_name
     FROM shifts s LEFT JOIN users uo ON uo.id = s.opened_by LEFT JOIN users uc ON uc.id = s.closed_by
     WHERE s.id = ?`,
    shiftId
  )
  if (!s) throw new Error('ไม่พบกะ')
  const rows = all<{ kind: string; method: string; amount: number; n: number }>(
    `SELECT kind, method, SUM(amount) AS amount, COUNT(*) AS n FROM payments WHERE shift_id = ?
     GROUP BY kind, method`,
    shiftId
  )
  const sum = (kind: string, method?: string): number =>
    r2(rows.filter((r) => r.kind === kind && (!method || r.method === method)).reduce((t, r) => t + r.amount, 0))
  const byMethod = Object.fromEntries(
    METHODS.map((m) => [m, r2(sum('payment', m) + sum('deposit', m) - sum('refund', m))])
  )
  const bills = one<{ n: number; total: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM invoices WHERE shift_id = ? AND status <> 'void'`,
    shiftId
  )!
  const voids = one<{ n: number }>("SELECT COUNT(*) AS n FROM invoices WHERE shift_id = ? AND status = 'void'", shiftId)!
  const cashIn = r2(sum('payment', 'cash') + sum('deposit', 'cash'))
  const cashOut = sum('refund', 'cash')
  const expected = r2(s.opening_cash + cashIn - cashOut)
  return {
    ...s,
    by_method: byMethod,
    deposits_received: sum('deposit'),
    refunds: sum('refund'),
    cash_in: cashIn,
    cash_out: cashOut,
    expected_cash: s.closed_at ? s.expected_cash : expected,
    bill_count: bills.n,
    bill_total: r2(bills.total),
    void_count: voids.n
  }
}

/* ---------------- money helpers ---------------- */

function validatePayments(payments: PayIn[], customerId: string | null): PayIn[] {
  const clean = (payments ?? [])
    .map((p) => ({ method: p.method, amount: r2(Number(p.amount) || 0) }))
    .filter((p) => p.amount !== 0)
  for (const p of clean) {
    if (!METHODS.includes(p.method)) throw new Error('ช่องทางชำระเงินไม่ถูกต้อง')
    if (p.amount < 0) throw new Error('ยอดชำระต้องไม่ติดลบ')
  }
  const fromDeposit = r2(clean.filter((p) => p.method === 'deposit').reduce((t, p) => t + p.amount, 0))
  if (fromDeposit > 0) {
    if (!customerId) throw new Error('ใช้เงินมัดจำได้เฉพาะบิลที่ระบุลูกค้า')
    const bal = depositBalance(customerId)
    if (fromDeposit > bal) throw new Error(`เงินมัดจำคงเหลือไม่พอ (คงเหลือ ${bal.toFixed(2)} บาท)`)
  }
  return clean
}

function addPayments(
  user: SessionUser,
  shiftId: string,
  invoiceId: string,
  customerId: string | null,
  payments: PayIn[]
): void {
  const at = now()
  for (const p of payments) {
    insert('payments', {
      id: uid(),
      invoice_id: invoiceId,
      customer_id: customerId,
      kind: 'payment',
      method: p.method,
      amount: p.amount,
      shift_id: shiftId,
      created_by: user.id,
      paid_at: at
    })
  }
}

function statusFor(total: number, paid: number): 'paid' | 'partial' | 'unpaid' {
  if (paid >= total - 0.001) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}

/** Bill numbers follow the old program: BE yymmdd + running number of the day, e.g. 691015001. */
function nextBillNo(): string {
  const d = new Date()
  const key = `${beYear(d)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `${key}${String(nextCounter(`BILL${key}`)).padStart(3, '0')}`
}

/* ---------------- stock ---------------- */

export function moveStock(
  productId: string,
  type: string,
  qty: number,
  unitCost: number,
  userId: string,
  refId?: string,
  note?: string
): void {
  insert('stock_moves', { id: uid(), product_id: productId, type, qty, unit_cost: unitCost, ref_id: refId, note, created_by: userId })
  const p = one<{ stock_qty: number }>('SELECT stock_qty FROM products WHERE id = ?', productId)!
  update('products', productId, { stock_qty: r2(p.stock_qty + qty) })
}

/* ---------------- checkout calculation ---------------- */

interface CartItem {
  product_id: string
  name?: string
  qty: number
  unit_price: number
  discount?: number
  vet_id?: string | null
  instruction?: string
  unit_cost?: number
}

export function computeBill(items: CartItem[], billDiscount: number): any {
  const vatEnabled = getSetting('vat_enabled') === '1'
  const vatInclusive = getSetting('vat_inclusive', '1') === '1'
  const vatRate = vatEnabled ? Number(getSetting('vat_rate', '7')) : 0

  const lines = items.map((it, i) => {
    const p = one<any>('SELECT * FROM products WHERE id = ?', it.product_id)
    if (!p) throw new Error('ไม่พบสินค้า/บริการในรายการ')
    const qty = Number(it.qty)
    const unitPrice = r2(Number(it.unit_price))
    if (!(qty > 0)) throw new Error(`จำนวนของ "${p.name}" ต้องมากกว่า 0`)
    if (unitPrice < 0) throw new Error(`ราคาของ "${p.name}" ต้องไม่ติดลบ`)
    const gross = r2(qty * unitPrice)
    const discount = r2(Math.min(Math.max(Number(it.discount) || 0, 0), gross))
    return {
      seq: i + 1,
      product: p,
      name: it.name?.trim() || p.name,
      qty,
      unit_price: unitPrice,
      gross,
      discount,
      line_total: r2(gross - discount),
      vet_id: it.vet_id || null,
      instruction: it.instruction?.trim() || null,
      unit_cost: it.unit_cost
    }
  })
  if (!lines.length) throw new Error('ยังไม่มีรายการในบิล')

  const subtotal = r2(lines.reduce((t, l) => t + l.gross, 0))
  const lineDiscount = r2(lines.reduce((t, l) => t + l.discount, 0))
  const afterLines = r2(subtotal - lineDiscount)
  const bill = r2(Math.min(Math.max(Number(billDiscount) || 0, 0), afterLines))
  const net = r2(afterLines - bill)
  const discountPct = subtotal > 0 ? ((lineDiscount + bill) / subtotal) * 100 : 0

  // Spread the bill discount over lines to split VAT-able vs exempt amounts.
  let vatBase = 0
  let exemptBase = 0
  for (const l of lines) {
    const share = afterLines > 0 ? l.line_total - (bill * l.line_total) / afterLines : 0
    if (l.product.vat_type === 'vat') vatBase += share
    else exemptBase += share
  }
  vatBase = r2(vatBase)
  exemptBase = r2(net - vatBase)

  let vatAmount = 0
  let vatableAmount = 0
  let total = net
  if (vatEnabled && vatRate > 0) {
    if (vatInclusive) {
      vatAmount = r2((vatBase * vatRate) / (100 + vatRate))
      vatableAmount = r2(vatBase - vatAmount)
    } else {
      vatAmount = r2((vatBase * vatRate) / 100)
      vatableAmount = vatBase
      total = r2(net + vatAmount)
    }
  }
  const costTotal = r2(lines.reduce((t, l) => t + l.qty * (l.product.avg_cost || 0), 0))
  return {
    lines,
    subtotal,
    line_discount: lineDiscount,
    bill_discount: bill,
    discount_pct: Math.round(discountPct * 100) / 100,
    vat_enabled: vatEnabled,
    vat_inclusive: vatInclusive,
    vat_rate: vatRate,
    vatable_amount: vatEnabled ? vatableAmount : 0,
    exempt_amount: vatEnabled ? exemptBase : 0,
    vat_amount: vatAmount,
    total,
    cost_total: costTotal
  }
}

interface CheckoutIn {
  customer_id?: string
  pet_id?: string
  visit_id?: string
  queue_id?: string
  admission_id?: string
  items: CartItem[]
  bill_discount: number
  payments: PayIn[]
  note?: string
  approval?: Approval
}

/** Create a bill with its items, stock moves, vaccine records and payments (caller wraps in tx). */
export function createInvoice(u: SessionUser, a: CheckoutIn): { id: string; invoice_no: string; status: string; total: number; paid: number } {
  const shift = requireOpenShift()
  const b = computeBill(a.items, a.bill_discount)
  const customerId = a.customer_id || null

  let approvedBy: string | null = null
  if (u.role !== 'owner' && b.discount_pct > u.max_discount_pct + 0.001) {
    if (!a.approval) throw new Error(`ส่วนลด ${b.discount_pct}% เกินสิทธิ์ของคุณ (${u.max_discount_pct}%) — ต้องให้ผู้มีสิทธิ์อนุมัติ`)
    approvedBy = approve(a.approval.username, a.approval.pin, { discountPct: b.discount_pct }).id
  }

  for (const l of b.lines) {
    if (l.product.needs_vet && !l.vet_id) throw new Error(`กรุณาเลือกสัตวแพทย์ผู้ทำ "${l.name}"`)
  }

  const payments = validatePayments(a.payments, customerId)
  const paid = r2(payments.reduce((t, p) => t + p.amount, 0))
  if (paid > b.total + 0.001) throw new Error('ยอดชำระเกินยอดบิล (เงินทอนคำนวณที่หน้าจอ ไม่ต้องบันทึก)')
  const status = statusFor(b.total, paid)
  if (status !== 'paid' && !customerId) throw new Error('บิลค้างชำระต้องระบุลูกค้า')

  const id = uid()
  const invoiceNo = nextBillNo()
  insert('invoices', {
    id,
    invoice_no: invoiceNo,
    doc_type: b.vat_enabled ? 'tax_invoice_abb' : 'receipt',
    customer_id: customerId,
    pet_id: a.pet_id,
    visit_id: a.visit_id,
    admission_id: a.admission_id,
    status,
    subtotal: b.subtotal,
    line_discount: b.line_discount,
    bill_discount: b.bill_discount,
    vat_enabled: b.vat_enabled,
    vat_inclusive: b.vat_inclusive,
    vat_rate: b.vat_rate,
    vatable_amount: b.vatable_amount,
    exempt_amount: b.exempt_amount,
    vat_amount: b.vat_amount,
    total: b.total,
    paid_amount: paid,
    cost_total: b.cost_total,
    note: a.note,
    discount_approved_by: approvedBy,
    shift_id: shift.id,
    created_by: u.id,
    issued_at: now()
  })

  for (const l of b.lines) {
    insert('invoice_items', {
      id: uid(),
      invoice_id: id,
      seq: l.seq,
      product_id: l.product.id,
      name: l.name,
      category: l.product.category,
      unit: l.product.unit,
      qty: l.qty,
      unit_price: l.unit_price,
      discount: l.discount,
      line_total: l.line_total,
      unit_cost: l.unit_cost ?? (l.product.avg_cost || 0),
      vat_type: l.product.vat_type,
      vet_id: l.vet_id,
      instruction: l.instruction,
      from_admission: !!a.admission_id
    })
    // Admit charges already took stock when they were recorded.
    if (l.product.track_stock && !a.admission_id) moveStock(l.product.id, 'sale', -l.qty, l.product.avg_cost || 0, u.id, id)
    if (l.product.category === 'vaccine' && a.pet_id) {
      const vt = one<{ id: string }>('SELECT id FROM vaccine_types WHERE product_id = ? AND active = 1', l.product.id)
      recordVaccination({
        pet_id: a.pet_id,
        vaccine_type_id: vt?.id,
        name: vt ? undefined : l.name,
        vet_id: l.vet_id ?? undefined,
        invoice_id: id
      })
    }
  }

  addPayments(u, shift.id, id, customerId, payments)
  if (a.visit_id) update('visits', a.visit_id, { invoice_id: id })
  if (a.queue_id) update('queue', a.queue_id, { invoice_id: id, status: 'done' })
  if (a.admission_id) update('admissions', a.admission_id, { invoice_id: id, status: 'discharged', discharged_at: now() })
  audit(u.id, 'invoice.create', 'invoices', id, {
    invoice_no: invoiceNo,
    total: b.total,
    discount: b.line_discount + b.bill_discount,
    approved_by: approvedBy
  })
  return { id, invoice_no: invoiceNo, status, total: b.total, paid }
}

/* ---------------- API ---------------- */

export const salesApi = {
  /* ----- products ----- */
  'products.list': (a: { q?: string; category?: string; includeInactive?: boolean }) =>
    all(
      `SELECT * FROM products
       WHERE (?1 = '' OR name LIKE '%' || ?1 || '%' OR sku LIKE '%' || ?1 || '%')
         AND (?2 = '' OR category = ?2) AND (?3 = 1 OR active = 1)
       ORDER BY category, name`,
      (a.q ?? '').trim(),
      a.category ?? '',
      a.includeInactive ? 1 : 0
    ),

  'products.lowStock': () =>
    all('SELECT * FROM products WHERE active = 1 AND track_stock = 1 AND stock_qty <= min_stock ORDER BY name'),

  'products.save': (a: Record<string, any>) => {
    const u = requirePerm('stock.edit')
    if (!a.name?.trim()) throw new Error('กรุณากรอกชื่อสินค้า/บริการ')
    return tx(() => {
      const service = ['service', 'procedure', 'grooming', 'boarding'].includes(a.category)
      const row = {
        sku: a.sku?.trim(),
        name: a.name.trim(),
        category: a.category,
        unit: a.unit || 'ชิ้น',
        price: r2(Number(a.price) || 0),
        min_stock: Number(a.min_stock) || 0,
        track_stock: service ? false : !!a.track_stock,
        vat_type: a.vat_type === 'exempt' ? 'exempt' : 'vat',
        needs_vet: !!a.needs_vet,
        drug_group: a.drug_group,
        label_th: a.label_th,
        label_en: a.label_en,
        controlled: !!a.controlled,
        note: a.note,
        active: a.active ?? true
      }
      if (a.id) {
        const before = one<any>('SELECT price FROM products WHERE id = ?', a.id)
        update('products', a.id, row)
        audit(u.id, 'product.update', 'products', a.id, before?.price !== row.price ? { price: [before?.price, row.price] } : undefined)
        return a.id
      }
      const id = uid()
      insert('products', { id, ...row })
      if (row.track_stock && Number(a.opening_qty) > 0) {
        const cost = r2(Number(a.opening_cost) || 0)
        update('products', id, { avg_cost: cost })
        moveStock(id, 'receive', Number(a.opening_qty), cost, u.id, undefined, 'ยอดยกมา')
      }
      audit(u.id, 'product.create', 'products', id)
      return id
    })
  },

  'stock.receive': (a: { product_id: string; qty: number; unit_cost: number; note?: string }) => {
    const u = requirePerm('stock.edit')
    const qty = Number(a.qty)
    const cost = r2(Number(a.unit_cost) || 0)
    if (!(qty > 0)) throw new Error('จำนวนรับเข้าต้องมากกว่า 0')
    return tx(() => {
      const p = one<any>('SELECT * FROM products WHERE id = ?', a.product_id)!
      // Weighted average cost; negative stock is treated as zero so it can't distort cost.
      const onHand = Math.max(p.stock_qty, 0)
      const avg = onHand + qty > 0 ? r2((onHand * p.avg_cost + qty * cost) / (onHand + qty)) : cost
      update('products', p.id, { avg_cost: avg })
      moveStock(p.id, 'receive', qty, cost, u.id, undefined, a.note)
      audit(u.id, 'stock.receive', 'products', p.id, { qty, cost })
      return true
    })
  },

  'stock.adjust': (a: { product_id: string; counted_qty: number; reason: string }) => {
    const u = requirePerm('stock.edit')
    if (!a.reason?.trim()) throw new Error('กรุณาระบุเหตุผลการปรับสต็อก')
    return tx(() => {
      const p = one<any>('SELECT * FROM products WHERE id = ?', a.product_id)!
      const delta = r2(Number(a.counted_qty) - p.stock_qty)
      if (delta === 0) return true
      moveStock(p.id, 'adjust', delta, p.avg_cost, u.id, undefined, a.reason)
      audit(u.id, 'stock.adjust', 'products', p.id, { from: p.stock_qty, to: Number(a.counted_qty), reason: a.reason })
      return true
    })
  },

  'stock.moves': (a: { product_id: string }) =>
    all(
      `SELECT m.*, u.display_name AS user_name, i.invoice_no FROM stock_moves m
       LEFT JOIN users u ON u.id = m.created_by LEFT JOIN invoices i ON i.id = m.ref_id
       WHERE m.product_id = ? ORDER BY m.created_at DESC LIMIT 200`,
      a.product_id
    ),

  /* ----- shifts ----- */
  'shifts.current': () => {
    const s = openShift()
    return s ? shiftSummary(s.id) : null
  },

  'shifts.open': (a: { opening_cash: number }) => {
    const u = requirePerm('shift')
    if (openShift()) throw new Error('มีกะที่เปิดอยู่แล้ว')
    const id = uid()
    insert('shifts', { id, opened_by: u.id, opened_at: now(), opening_cash: r2(Number(a.opening_cash) || 0) })
    audit(u.id, 'shift.open', 'shifts', id, { opening_cash: a.opening_cash })
    return id
  },

  'shifts.close': (a: { counted_cash: number; note?: string }) => {
    const u = requirePerm('shift')
    return tx(() => {
      const s = requireOpenShift()
      const sum = shiftSummary(s.id)
      const counted = r2(Number(a.counted_cash) || 0)
      const diff = r2(counted - sum.expected_cash)
      update('shifts', s.id, {
        closed_by: u.id,
        closed_at: now(),
        expected_cash: sum.expected_cash,
        counted_cash: counted,
        diff,
        note: a.note
      })
      audit(u.id, 'shift.close', 'shifts', s.id, { expected: sum.expected_cash, counted, diff })
      return shiftSummary(s.id)
    })
  },

  'shifts.list': () =>
    all(
      `SELECT s.*, uo.display_name AS opened_by_name, uc.display_name AS closed_by_name
       FROM shifts s LEFT JOIN users uo ON uo.id = s.opened_by LEFT JOIN users uc ON uc.id = s.closed_by
       ORDER BY s.opened_at DESC LIMIT 60`
    ),

  'shifts.summary': (a: { id: string }) => shiftSummary(a.id),

  /* ----- checkout ----- */
  'pos.preview': (a: { items: CartItem[]; bill_discount: number }) => {
    const b = computeBill(a.items, a.bill_discount)
    const u = requireUser()
    return {
      ...b,
      lines: b.lines.map(({ product, ...l }: any) => ({ ...l, category: product.category, unit: product.unit })),
      needs_approval: u.role !== 'owner' && b.discount_pct > u.max_discount_pct + 0.001
    }
  },

  'pos.checkout': (a: CheckoutIn) => {
    const u = requireUser()
    return tx(() => createInvoice(u, a))
  },


  /* ----- invoices ----- */
  'invoices.list': (a: { from?: string; to?: string; status?: string; q?: string }) =>
    all(
      `SELECT i.*, c.name AS customer_name, p.name AS pet_name, u.display_name AS created_by_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN pets p ON p.id = i.pet_id
       LEFT JOIN users u ON u.id = i.created_by
       WHERE date(i.issued_at) BETWEEN ?1 AND ?2
         AND (?3 = '' OR i.status = ?3 OR (?3 = 'outstanding' AND i.status IN ('unpaid','partial')))
         AND (?4 = '' OR i.invoice_no LIKE '%' || ?4 || '%' OR c.name LIKE '%' || ?4 || '%' OR c.phone LIKE '%' || ?4 || '%')
       ORDER BY i.issued_at DESC LIMIT 500`,
      a.from || '0000-01-01',
      a.to || '9999-12-31',
      a.status ?? '',
      (a.q ?? '').trim()
    ),

  'invoices.get': (a: { id: string }) => {
    const inv = one<any>(
      `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              c.tax_id AS customer_tax_id, c.code AS customer_code,
              p.name AS pet_name, p.species AS pet_species,
              u.display_name AS created_by_name, vu.display_name AS void_by_name,
              au.display_name AS void_approved_by_name, du.display_name AS discount_approved_by_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN pets p ON p.id = i.pet_id
       LEFT JOIN users u ON u.id = i.created_by LEFT JOIN users vu ON vu.id = i.void_by
       LEFT JOIN users au ON au.id = i.void_approved_by LEFT JOIN users du ON du.id = i.discount_approved_by
       WHERE i.id = ?`,
      a.id
    )
    if (!inv) throw new Error('ไม่พบบิล')
    inv.items = all(
      `SELECT it.*, u.display_name AS vet_name FROM invoice_items it LEFT JOIN users u ON u.id = it.vet_id
       WHERE it.invoice_id = ? ORDER BY it.seq`,
      a.id
    )
    inv.payments = all(
      `SELECT pm.*, u.display_name AS user_name FROM payments pm LEFT JOIN users u ON u.id = pm.created_by
       WHERE pm.invoice_id = ? ORDER BY pm.paid_at`,
      a.id
    )
    return inv
  },

  'invoices.pay': (a: { id: string; payments: PayIn[] }) => {
    const u = requireUser()
    return tx(() => {
      const shift = requireOpenShift()
      const inv = one<any>('SELECT * FROM invoices WHERE id = ?', a.id)
      if (!inv) throw new Error('ไม่พบบิล')
      if (!['unpaid', 'partial'].includes(inv.status)) throw new Error('บิลนี้ไม่มียอดค้างชำระ')
      const payments = validatePayments(a.payments, inv.customer_id)
      const amount = r2(payments.reduce((t, p) => t + p.amount, 0))
      const due = r2(inv.total - inv.paid_amount)
      if (amount <= 0) throw new Error('กรุณาระบุยอดชำระ')
      if (amount > due + 0.001) throw new Error(`ยอดชำระเกินยอดค้าง (${due.toFixed(2)} บาท)`)
      addPayments(u, shift.id, inv.id, inv.customer_id, payments)
      const paid = r2(inv.paid_amount + amount)
      update('invoices', inv.id, { paid_amount: paid, status: statusFor(inv.total, paid) })
      audit(u.id, 'invoice.pay', 'invoices', inv.id, { amount })
      return true
    })
  },

  'invoices.void': (a: { id: string; reason: string; approval?: Approval }) => {
    const u = requireUser()
    if (!a.reason?.trim()) throw new Error('กรุณาระบุเหตุผลการยกเลิกบิล')
    return tx(() => {
      let approver: SessionUser = u
      if (!can(u, 'void')) {
        if (!a.approval) throw new Error('การยกเลิกบิลต้องให้ผู้จัดการหรือเจ้าของร้านอนุมัติ')
        approver = approve(a.approval.username, a.approval.pin, { perm: 'void' })
      }
      const inv = one<any>('SELECT * FROM invoices WHERE id = ?', a.id)
      if (!inv) throw new Error('ไม่พบบิล')
      if (inv.status === 'void') throw new Error('บิลนี้ถูกยกเลิกไปแล้ว')

      const pays = all<any>("SELECT * FROM payments WHERE invoice_id = ? AND kind = 'payment'", inv.id)
      const refundShift = pays.length ? requireOpenShift() : null
      for (const p of pays) {
        insert('payments', {
          id: uid(),
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          kind: 'refund',
          method: p.method,
          amount: p.amount,
          note: `คืนเงินจากการยกเลิกบิล ${inv.invoice_no}`,
          shift_id: refundShift!.id,
          created_by: u.id,
          paid_at: now()
        })
      }
      for (const it of all<any>(
        `SELECT it.* FROM invoice_items it JOIN products p ON p.id = it.product_id
         WHERE it.invoice_id = ? AND p.track_stock = 1 AND it.from_admission = 0`,
        inv.id
      )) {
        moveStock(it.product_id, 'void_return', it.qty, it.unit_cost, u.id, inv.id, `ยกเลิกบิล ${inv.invoice_no}`)
      }
      if (inv.admission_id) update('admissions', inv.admission_id, { status: 'admitted', invoice_id: null, discharged_at: null })
      update('invoices', inv.id, {
        status: 'void',
        void_reason: a.reason.trim(),
        void_by: u.id,
        void_approved_by: approver.id,
        void_at: now()
      })
      audit(u.id, 'invoice.void', 'invoices', inv.id, {
        invoice_no: inv.invoice_no,
        total: inv.total,
        refunded: r2(pays.reduce((t, p) => t + p.amount, 0)),
        reason: a.reason,
        approved_by: approver.id
      })
      return true
    })
  },

  /* ----- deposits ----- */
  'deposits.add': (a: { customer_id: string; method: Method; amount: number; note?: string }) => {
    const u = requireUser()
    const amount = r2(Number(a.amount) || 0)
    if (amount <= 0) throw new Error('ยอดมัดจำต้องมากกว่า 0')
    if (a.method === 'deposit') throw new Error('ช่องทางไม่ถูกต้อง')
    return tx(() => {
      const shift = requireOpenShift()
      const id = uid()
      insert('payments', {
        id,
        customer_id: a.customer_id,
        kind: 'deposit',
        method: a.method,
        amount,
        note: a.note,
        shift_id: shift.id,
        created_by: u.id,
        paid_at: now()
      })
      audit(u.id, 'deposit.add', 'customers', a.customer_id, { amount, method: a.method })
      return id
    })
  },

  'deposits.refund': (a: { customer_id: string; method: Method; amount: number; note?: string }) => {
    const u = requireUser()
    const amount = r2(Number(a.amount) || 0)
    if (amount <= 0) throw new Error('ยอดคืนต้องมากกว่า 0')
    return tx(() => {
      const shift = requireOpenShift()
      const bal = depositBalance(a.customer_id)
      if (amount > bal) throw new Error(`คืนได้ไม่เกินยอดคงเหลือ ${bal.toFixed(2)} บาท`)
      insert('payments', {
        id: uid(),
        customer_id: a.customer_id,
        kind: 'refund',
        method: a.method,
        amount,
        note: a.note || 'คืนเงินมัดจำ',
        shift_id: shift.id,
        created_by: u.id,
        paid_at: now()
      })
      audit(u.id, 'deposit.refund', 'customers', a.customer_id, { amount, method: a.method })
      return true
    })
  },

  'deposits.history': (a: { customer_id: string }) =>
    all(
      `SELECT pm.*, i.invoice_no, u.display_name AS user_name FROM payments pm
       LEFT JOIN invoices i ON i.id = pm.invoice_id LEFT JOIN users u ON u.id = pm.created_by
       WHERE pm.customer_id = ? AND (pm.kind = 'deposit' OR pm.method = 'deposit' OR (pm.kind = 'refund' AND pm.invoice_id IS NULL))
       ORDER BY pm.paid_at DESC`,
      a.customer_id
    ),

  /* ----- PromptPay ----- */
  'promptpay.qr': async (a: { amount: number }) => {
    const id = getSetting('promptpay_id').replace(/[^0-9]/g, '')
    if (!id) return null
    const payload = generatePayload(id, { amount: r2(Number(a.amount) || 0) })
    return QRCode.toDataURL(payload, { margin: 1, width: 320 })
  }
}
