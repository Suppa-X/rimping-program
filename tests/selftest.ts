// Run with: npm run selftest — exercises the main-process business logic against a temp database.
import { app } from 'electron'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { openDb, setSetting, one } from '../src/main/db'
import { authApi } from '../src/main/auth'
import { clinicApi } from '../src/main/api/clinic'
import { salesApi } from '../src/main/api/sales'
import { reportsApi } from '../src/main/api/reports'

const api: Record<string, (a: any) => any> = { ...authApi, ...clinicApi, ...salesApi, ...reportsApi }
let failed = 0
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log('  ✔', name)
  else {
    failed++
    console.log('  ✘', name, detail ?? '')
  }
}
function throws(name: string, fn: () => unknown, msg: RegExp): void {
  try {
    fn()
    check(name, false, 'did not throw')
  } catch (e: any) {
    check(name, msg.test(e.message), e.message)
  }
}

app.whenReady().then(async () => {
  process.on('unhandledRejection', (e) => { console.log('  ✘ crashed:', e); app.exit(1) })
  const dir = mkdtempSync(join(tmpdir(), 'rimping-test-'))
  openDb(join(dir, 'test.db'))

  console.log('auth')
  api['auth.setupOwner']({ username: 'owner', display_name: 'หมอเจ้าของ', pin: '1111', is_vet: true })
  throws('wrong pin rejected', () => api['auth.login']({ username: 'owner', pin: '0000' }), /ไม่ถูกต้อง/)
  const owner = api['auth.login']({ username: 'owner', pin: '1111' })
  api['users.save']({ username: 'staff', display_name: 'พนักงาน', role: 'staff', pin: '2222', max_discount_pct: 5, is_vet: false })
  api['users.save']({ username: 'mgr', display_name: 'ผู้จัดการ', role: 'manager', pin: '3333', max_discount_pct: 20, is_vet: false })

  console.log('customers / pets')
  const cid = api['customers.save']({ name: 'คุณสมศรี', phone: '0812345678', pdpa_consent: true })
  const pid = api['pets.save']({ customer_id: cid, name: 'ข้าวตู', species: 'สุนัข', sex: 'M' })
  check('search by pet name', api['customers.search']({ q: 'ข้าวตู' }).length === 1)
  check('search by phone', api['customers.search']({ q: '0812' }).length === 1)

  const prods = api['products.list']({})
  const exam = prods.find((p: any) => p.name === 'ค่าตรวจรักษา')
  const rabies = prods.find((p: any) => p.name === 'วัคซีนพิษสุนัขบ้า')
  const foodId = api['products.save']({ name: 'อาหารเม็ด 1kg', category: 'food', price: 250, unit: 'ถุง', track_stock: true, vat_type: 'vat', opening_qty: 10, opening_cost: 150 })
  api['stock.receive']({ product_id: foodId, qty: 10, unit_cost: 170 })
  check('weighted avg cost = 160', one<any>('SELECT avg_cost FROM products WHERE id=?', foodId).avg_cost === 160)

  console.log('shift + checkout')
  throws('checkout needs open shift', () => api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 0, payments: [{ method: 'cash', amount: 250 }] }), /เปิดกะ/)
  api['shifts.open']({ opening_cash: 1000 })
  throws('service needs vet', () => api['pos.checkout']({ customer_id: cid, items: [{ product_id: exam.id, qty: 1, unit_price: 200 }], bill_discount: 0, payments: [] }), /สัตวแพทย์/)
  const b1 = api['pos.checkout']({
    customer_id: cid,
    pet_id: pid,
    items: [
      { product_id: exam.id, qty: 1, unit_price: 200, vet_id: owner.id },
      { product_id: rabies.id, qty: 1, unit_price: 300, vet_id: owner.id },
      { product_id: foodId, qty: 2, unit_price: 250 }
    ],
    bill_discount: 0,
    payments: [
      { method: 'cash', amount: 600 },
      { method: 'transfer', amount: 400 }
    ]
  })
  check('bill total 1000 paid', b1.total === 1000 && b1.status === 'paid', b1)
  check('receipt number format', /^RC\d{4}-0001$/.test(b1.invoice_no), b1.invoice_no)
  check('stock reduced to 18', one<any>('SELECT stock_qty FROM products WHERE id=?', foodId).stock_qty === 18)
  const vac = one<any>('SELECT * FROM vaccinations WHERE pet_id=?', pid)
  check('vaccine auto-recorded with next due date', !!vac?.next_due_date && vac.name === 'พิษสุนัขบ้า', vac)
  throws('overpay rejected', () => api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 0, payments: [{ method: 'cash', amount: 300 }] }), /เกิน/)
  throws('walk-in cannot owe', () => api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 0, payments: [] }), /ระบุลูกค้า/)

  console.log('outstanding + deposit')
  const b2 = api['pos.checkout']({ customer_id: cid, items: [{ product_id: foodId, qty: 2, unit_price: 250 }], bill_discount: 0, payments: [{ method: 'cash', amount: 200 }] })
  check('partial bill', b2.status === 'partial')
  api['invoices.pay']({ id: b2.id, payments: [{ method: 'promptpay', amount: 300 }] })
  check('paid after settling', one<any>('SELECT status FROM invoices WHERE id=?', b2.id).status === 'paid')
  api['deposits.add']({ customer_id: cid, method: 'cash', amount: 500 })
  check('deposit balance 500', api['customers.get']({ id: cid }).deposit_balance === 500)
  const b3 = api['pos.checkout']({ customer_id: cid, items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 0, payments: [{ method: 'deposit', amount: 250 }] })
  check('deposit balance 250 after use', api['customers.get']({ id: cid }).deposit_balance === 250)
  throws('cannot overspend deposit', () => api['pos.checkout']({ customer_id: cid, items: [{ product_id: foodId, qty: 2, unit_price: 250 }], bill_discount: 0, payments: [{ method: 'deposit', amount: 500 }] }), /ไม่พอ/)

  console.log('discount limits + void (as staff)')
  api['auth.login']({ username: 'staff', pin: '2222' })
  throws('staff 10% discount blocked', () => api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 25, payments: [{ method: 'cash', amount: 225 }] }), /เกินสิทธิ์/)
  throws('staff cannot self-approve', () => api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 25, payments: [{ method: 'cash', amount: 225 }], approval: { username: 'staff', pin: '2222' } }), /อนุมัติส่วนลดได้ไม่เกิน/)
  const b4 = api['pos.checkout']({ items: [{ product_id: foodId, qty: 1, unit_price: 250 }], bill_discount: 25, payments: [{ method: 'cash', amount: 225 }], approval: { username: 'mgr', pin: '3333' } })
  check('manager-approved discount ok', b4.total === 225)
  throws('staff void needs approval', () => api['invoices.void']({ id: b3.id, reason: 'คิดผิด' }), /อนุมัติ/)
  api['invoices.void']({ id: b3.id, reason: 'คิดผิด', approval: { username: 'mgr', pin: '3333' } })
  check('void restores deposit', api['customers.get']({ id: cid }).deposit_balance === 500)
  check('void restores stock', one<any>('SELECT stock_qty FROM products WHERE id=?', foodId).stock_qty === 15)

  api['auth.login']({ username: 'owner', pin: '1111' })
  console.log('queue')
  const q = api['queue.add']({ pet_id: pid, reason: 'ตรวจ' })
  check('first queue number is 1', q.queue_no === 1)
  throws('same pet cannot queue twice', () => api['queue.add']({ pet_id: pid }), /อยู่ในคิวแล้ว/)
  const qv = api['visits.save']({ pet_id: pid, subjective: 'ซึม', queue_id: q.id })
  check('visit moves queue to payment', one<any>('SELECT status FROM queue WHERE id=?', q.id).status === 'to_pay')
  api['pos.checkout']({ customer_id: cid, pet_id: pid, visit_id: qv, queue_id: q.id, items: [{ product_id: exam.id, qty: 1, unit_price: 200, vet_id: owner.id }], bill_discount: 0, payments: [{ method: 'transfer', amount: 200 }] })
  check('checkout closes queue', one<any>('SELECT status FROM queue WHERE id=?', q.id).status === 'done')

  console.log('VAT')
  api['auth.login']({ username: 'owner', pin: '1111' })
  setSetting('vat_enabled', '1')
  const pv = api['pos.preview']({ items: [{ product_id: foodId, qty: 1, unit_price: 107 }], bill_discount: 0 })
  check('inclusive VAT 7 on 107', pv.vat_amount === 7 && pv.total === 107, pv)
  setSetting('vat_inclusive', '0')
  const pe = api['pos.preview']({ items: [{ product_id: foodId, qty: 1, unit_price: 100 }], bill_discount: 0 })
  check('exclusive VAT adds 7', pe.vat_amount === 7 && pe.total === 107, pe)
  setSetting('vat_enabled', '0')
  setSetting('vat_inclusive', '1')

  console.log('shift close + reports')
  const s = api['shifts.current']({})
  // cash: 1000 opening + 600 + 200 + 500 deposit + 225 = 2525
  check('expected cash 2525', s.expected_cash === 2525, s)
  const closed = api['shifts.close']({ counted_cash: 2500 })
  check('shift diff -25', closed.diff === -25, closed)
  const today = one<any>("SELECT date('now','localtime') AS d").d
  const r = api['reports.sales']({ from: today, to: today })
  check('report total excludes void (1000+500+225+200)', r.total === 1925, r.total)
  check('gross profit = sales - cost', Math.abs(r.gross_profit - (r.net_sales - r.cost)) < 0.01)
  check('vet report has owner', r.by_vet.some((v: any) => v.vet_id === owner.id))
  check('sync outbox captured changes', one<any>('SELECT COUNT(*) AS n FROM sync_outbox').n > 0)

  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
  app.exit(failed ? 1 : 0)
})
