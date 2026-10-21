import { all, one, insert, update, uid, audit, tx, now, today, r2, nextCounter, beYear } from '../db'
import { requireUser } from '../auth'
import { depositBalance } from './clinic'
import { createInvoice, moveStock } from './sales'

const LIVE = `status = 'admitted'`

function chargesTotal(admissionId: string): number {
  return r2(
    one<{ t: number }>(
      'SELECT COALESCE(SUM(qty * unit_price - discount), 0) AS t FROM admission_charges WHERE admission_id = ? AND voided = 0',
      admissionId
    )!.t
  )
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to.slice(0, 10) + 'T00:00:00').getTime() - new Date(from.slice(0, 10) + 'T00:00:00').getTime()
  return Math.max(Math.round(ms / 86400000), 0) + 1
}

export const admissionsApi = {
  'admissions.list': (a: { status?: string }) =>
    all<any>(
      `SELECT ad.*, p.name AS pet_name, p.species, p.code AS pet_code, p.allergy_note, p.warning_note,
              c.name AS owner_name, c.phone, u.display_name AS vet_name,
              (SELECT COALESCE(SUM(qty * unit_price - discount),0) FROM admission_charges ch WHERE ch.admission_id = ad.id AND ch.voided = 0) AS total,
              (SELECT MAX(charge_date) FROM admission_charges ch WHERE ch.admission_id = ad.id AND ch.voided = 0) AS last_charge
       FROM admissions ad JOIN pets p ON p.id = ad.pet_id JOIN customers c ON c.id = ad.customer_id
       LEFT JOIN users u ON u.id = ad.vet_id
       WHERE ${a.status === 'all' ? '1=1' : a.status ? 'ad.status = ?' : `ad.${LIVE}`}
       ORDER BY ad.admitted_at DESC LIMIT 300`,
      ...(a.status && a.status !== 'all' ? [a.status] : [])
    ).map((r) => ({
      ...r,
      days: daysBetween(r.admitted_at, r.discharged_at ?? now()),
      deposit_balance: depositBalance(r.customer_id),
      charged_today: r.last_charge === today()
    })),

  'admissions.get': (a: { id: string }) => {
    const ad = one<any>(
      `SELECT ad.*, p.name AS pet_name, p.species, p.breed, p.code AS pet_code, p.weight_kg, p.allergy_note, p.warning_note,
              c.name AS owner_name, c.phone, u.display_name AS vet_name, i.invoice_no
       FROM admissions ad JOIN pets p ON p.id = ad.pet_id JOIN customers c ON c.id = ad.customer_id
       LEFT JOIN users u ON u.id = ad.vet_id LEFT JOIN invoices i ON i.id = ad.invoice_id WHERE ad.id = ?`,
      a.id
    )
    if (!ad) throw new Error('ไม่พบข้อมูล Admit')
    const charges = all(
      `SELECT ch.*, u.display_name AS vet_name, cu.display_name AS created_by_name FROM admission_charges ch
       LEFT JOIN users u ON u.id = ch.vet_id LEFT JOIN users cu ON cu.id = ch.created_by
       WHERE ch.admission_id = ? ORDER BY ch.charge_date DESC, ch.created_at DESC`,
      a.id
    )
    return {
      ...ad,
      charges,
      total: chargesTotal(a.id),
      days: daysBetween(ad.admitted_at, ad.discharged_at ?? now()),
      deposit_balance: depositBalance(ad.customer_id)
    }
  },

  'admissions.admit': (a: { pet_id: string; kind?: string; cage?: string; reason?: string; vet_id?: string; expected_out?: string; note?: string }) => {
    const u = requireUser()
    const pet = one<any>('SELECT * FROM pets WHERE id = ?', a.pet_id)
    if (!pet) throw new Error('กรุณาเลือกสัตว์เลี้ยง')
    if (one(`SELECT 1 FROM admissions WHERE pet_id = ? AND ${LIVE}`, pet.id)) throw new Error(`${pet.name} Admit อยู่แล้ว`)
    return tx(() => {
      const id = uid()
      const no = `AD${beYear()}-${String(nextCounter(`ADMIT${beYear()}`)).padStart(4, '0')}`
      insert('admissions', {
        id,
        admit_no: no,
        pet_id: pet.id,
        customer_id: pet.customer_id,
        kind: a.kind === 'boarding' ? 'boarding' : 'ipd',
        cage: a.cage,
        reason: a.reason,
        vet_id: a.vet_id || (u.is_vet ? u.id : null),
        admitted_at: now(),
        expected_out: a.expected_out,
        note: a.note,
        created_by: u.id
      })
      audit(u.id, 'admission.admit', 'admissions', id, { admit_no: no, pet: pet.name })
      return id
    })
  },

  'admissions.update': (a: { id: string; cage?: string; reason?: string; vet_id?: string; expected_out?: string; note?: string; kind?: string }) => {
    const u = requireUser()
    update('admissions', a.id, { cage: a.cage, reason: a.reason, vet_id: a.vet_id, expected_out: a.expected_out, note: a.note, kind: a.kind })
    audit(u.id, 'admission.update', 'admissions', a.id)
    return true
  },

  /** Record a charge on a stay. Stock is taken now, so the bill at discharge does not take it again. */
  'admissions.addCharge': (a: {
    admission_id: string
    product_id: string
    qty: number
    unit_price?: number
    discount?: number
    vet_id?: string
    charge_date?: string
    note?: string
  }) => {
    const u = requireUser()
    return tx(() => {
      const ad = one<any>('SELECT * FROM admissions WHERE id = ?', a.admission_id)
      if (!ad || ad.status !== 'admitted') throw new Error('ไม่สามารถลงค่าใช้จ่ายได้ (ไม่ได้ Admit อยู่)')
      const p = one<any>('SELECT * FROM products WHERE id = ?', a.product_id)
      if (!p) throw new Error('ไม่พบสินค้า/บริการ')
      const qty = Number(a.qty)
      if (!(qty > 0)) throw new Error('จำนวนต้องมากกว่า 0')
      const vet = a.vet_id || (p.needs_vet ? ad.vet_id : null)
      if (p.needs_vet && !vet) throw new Error(`กรุณาเลือกสัตวแพทย์ผู้ทำ "${p.name}"`)
      const id = uid()
      insert('admission_charges', {
        id,
        admission_id: ad.id,
        charge_date: a.charge_date || today(),
        product_id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        qty,
        unit_price: r2(a.unit_price ?? p.price),
        discount: r2(Number(a.discount) || 0),
        unit_cost: p.avg_cost || 0,
        vet_id: vet,
        note: a.note,
        created_by: u.id
      })
      if (p.track_stock) moveStock(p.id, 'admit', -qty, p.avg_cost || 0, u.id, ad.id, `Admit ${ad.admit_no}`)
      audit(u.id, 'admission.charge', 'admissions', ad.id, { item: p.name, qty })
      return id
    })
  },

  'admissions.voidCharge': (a: { id: string; reason?: string }) => {
    const u = requireUser()
    return tx(() => {
      const ch = one<any>('SELECT * FROM admission_charges WHERE id = ?', a.id)
      if (!ch || ch.voided) throw new Error('ไม่พบรายการ')
      const ad = one<any>('SELECT * FROM admissions WHERE id = ?', ch.admission_id)
      if (ad.status !== 'admitted') throw new Error('คิดเงินไปแล้ว แก้ไขไม่ได้')
      update('admission_charges', ch.id, { voided: 1, note: [ch.note, `ยกเลิก: ${a.reason ?? ''}`].filter(Boolean).join(' · ') })
      const p = one<any>('SELECT track_stock FROM products WHERE id = ?', ch.product_id)
      if (p?.track_stock) moveStock(ch.product_id, 'void_return', ch.qty, ch.unit_cost, u.id, ad.id, `ยกเลิกค่าใช้จ่าย Admit ${ad.admit_no}`)
      audit(u.id, 'admission.void_charge', 'admissions', ad.id, { item: ch.name, qty: ch.qty, reason: a.reason })
      return true
    })
  },

  /** Discharge: bill every charge (grouped per item/price/vet) and take payment. */
  'admissions.checkout': (a: { id: string; bill_discount: number; payments: any[]; note?: string; approval?: any }) => {
    const u = requireUser()
    return tx(() => {
      const ad = one<any>('SELECT * FROM admissions WHERE id = ?', a.id)
      if (!ad || ad.status !== 'admitted') throw new Error('รายการนี้คิดเงินไปแล้ว')
      const groups = all<any>(
        `SELECT product_id, MIN(name) AS name, unit_price, vet_id, SUM(qty) AS qty, SUM(discount) AS discount,
                SUM(qty * unit_cost) / SUM(qty) AS unit_cost
         FROM admission_charges WHERE admission_id = ? AND voided = 0
         GROUP BY product_id, unit_price, vet_id ORDER BY MIN(charge_date), MIN(created_at)`,
        ad.id
      )
      if (!groups.length) throw new Error('ยังไม่มีค่าใช้จ่าย — ถ้าไม่คิดเงินให้กด "ยกเลิก Admit"')
      return createInvoice(u, {
        customer_id: ad.customer_id,
        pet_id: ad.pet_id,
        admission_id: ad.id,
        items: groups.map((g) => ({
          product_id: g.product_id,
          name: g.name,
          qty: g.qty,
          unit_price: g.unit_price,
          discount: g.discount,
          vet_id: g.vet_id,
          unit_cost: r2(g.unit_cost)
        })),
        bill_discount: a.bill_discount,
        payments: a.payments,
        note: a.note ?? `Admit ${ad.admit_no}`,
        approval: a.approval
      })
    })
  },

  'admissions.cancel': (a: { id: string; reason: string }) => {
    const u = requireUser()
    const n = one<{ n: number }>('SELECT COUNT(*) AS n FROM admission_charges WHERE admission_id = ? AND voided = 0', a.id)!.n
    if (n) throw new Error('มีค่าใช้จ่ายอยู่ — ต้องยกเลิกรายการค่าใช้จ่ายก่อน หรือคิดเงินตามปกติ')
    update('admissions', a.id, { status: 'cancelled', discharged_at: now(), note: a.reason })
    audit(u.id, 'admission.cancel', 'admissions', a.id, { reason: a.reason })
    return true
  }
}
