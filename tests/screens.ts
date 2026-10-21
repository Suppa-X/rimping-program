// Dev helper: boots the built app against a temp profile, seeds demo data and saves screenshots.
// Run with: npm run screens  (output in out/screens/)
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

app.setPath('userData', mkdtempSync(join(tmpdir(), 'rimping-ui-')))
const outDir = join(__dirname, 'screens')
mkdirSync(outDir, { recursive: true })

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

app.on('browser-window-created', async (_e, win: BrowserWindow) => {
  if (BrowserWindow.getAllWindows().length > 1) return
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  win.setSize(1366, 860)
  const js = (code: string): Promise<any> => win.webContents.executeJavaScript(code)
  const call = (m: string, a: unknown = {}): Promise<any> =>
    js(`window.rimping.call(${JSON.stringify(m)}, ${JSON.stringify(a)}).then(r => { if (!r.ok) throw new Error(r.error); return r.data })`)
  const shot = async (name: string, hash?: string): Promise<void> => {
    if (hash !== undefined) await js(`location.hash = ${JSON.stringify(hash)}`)
    await wait(900)
    const img = await win.webContents.capturePage()
    writeFileSync(join(outDir, `${name}.png`), img.toPNG())
  }
  try {
    await wait(500)
    await shot('01-setup')
    await call('auth.setupOwner', { username: 'owner', display_name: 'หมอปิง', pin: '1111', is_vet: true })
    await js('location.reload()')
    await wait(1200)
    await shot('02-login')
    await call('auth.login', { username: 'owner', pin: '1111' })
    await call('settings.save', { shop_address: '123 ถ.ริมปิง ต.วัดเกต อ.เมือง จ.เชียงใหม่ 50000', shop_phone: '053-000-000', promptpay_id: '0812345678' })
    const cid = await call('customers.save', { name: 'คุณสมศรี ใจดี', phone: '0812345678', line_id: 'somsri', pdpa_consent: true })
    const pid = await call('pets.save', { customer_id: cid, name: 'ข้าวตู', species: 'สุนัข', breed: 'ชิสุ', sex: 'M', birth_date: '2022-03-01', weight_kg: 6.2, allergy_note: 'เพนิซิลลิน' })
    await call('pets.save', { customer_id: cid, name: 'มะลิ', species: 'แมว', breed: 'ไทย', sex: 'F', neutered: true })
    const me = await call('auth.me')
    const vid = await call('visits.save', { pet_id: pid, weight_kg: 6.4, temp_c: 39.2, subjective: 'ไม่กินอาหาร 2 วัน อาเจียน 1 ครั้ง', objective: 'ขาดน้ำเล็กน้อย ท้องกดเจ็บ', assessment: 'Gastroenteritis', plan: 'ให้น้ำเกลือใต้ผิวหนัง ยาลดอาเจียน นัดดูอาการ 3 วัน' })
    const food = await call('products.save', { name: 'Royal Canin Mini Adult 2kg', category: 'food', price: 690, unit: 'ถุง', track_stock: true, opening_qty: 3, opening_cost: 520, min_stock: 5 })
    await call('products.save', { name: 'Amoxicillin 250mg', category: 'medicine', price: 10, unit: 'เม็ด', track_stock: true, opening_qty: 200, opening_cost: 3 })
    const prods = await call('products.list', {})
    const exam = prods.find((p: any) => p.name === 'ค่าตรวจรักษา')
    const rabies = prods.find((p: any) => p.name === 'วัคซีนพิษสุนัขบ้า')
    await call('shifts.open', { opening_cash: 1000 })
    const b = await call('pos.checkout', {
      customer_id: cid, pet_id: pid, visit_id: vid,
      items: [
        { product_id: exam.id, qty: 1, unit_price: 200, vet_id: me.id },
        { product_id: rabies.id, qty: 1, unit_price: 300, vet_id: me.id },
        { product_id: food, qty: 1, unit_price: 690 }
      ],
      bill_discount: 40,
      payments: [{ method: 'cash', amount: 650 }, { method: 'promptpay', amount: 300 }]
    })
    await call('pos.checkout', { customer_id: cid, items: [{ product_id: food, qty: 1, unit_price: 690 }], bill_discount: 0, payments: [{ method: 'cash', amount: 200 }] })
    const c2 = await call('customers.save', { name: 'คุณสมชาย รักหมา', phone: '0822222222' })
    const p2 = await call('pets.save', { customer_id: c2, name: 'บราวนี่', species: 'สุนัข', breed: 'โกลเด้น', warning_note: 'ระวังกัด' })
    const c3 = await call('customers.save', { name: 'คุณนิดา แมวเยอะ', phone: '0833333333' })
    const p3 = await call('pets.save', { customer_id: c3, name: 'ส้มโอ', species: 'แมว' })
    const p4 = await call('pets.save', { customer_id: c3, name: 'ถั่วดำ', species: 'แมว' })
    await call('queue.add', { pet_id: p2, reason: 'ฉีดวัคซีน' })
    const q3 = await call('queue.add', { pet_id: p3, reason: 'ตรวจรักษา' })
    await call('queue.setStatus', { id: q3.id, status: 'in_exam', vet_id: me.id })
    const q4 = await call('queue.add', { pet_id: p4, reason: 'ถ่ายพยาธิ/หยดเห็บหมัด' })
    await call('queue.setStatus', { id: q4.id, status: 'to_pay', vet_id: me.id })
    const types = await call('vaccineTypes.list')
    await call('vaccinations.add', { pet_id: p2, vaccine_type_id: types[0].id, given_date: '2025-10-10' })
    await call('vaccinations.add', { pet_id: p3, vaccine_type_id: types[1].id, given_date: '2025-10-22' })
    await js('location.reload()')
    await wait(1200)
    await shot('03-home', '#/')
    await js('document.querySelector(".bigsearch input").focus()')
    await win.webContents.insertText('สม')
    await shot('03b-home-search')
    await shot('04-customers', '#/customers')
    await shot('05-customer', `#/customers/${cid}`)
    await shot('06-pet', `#/pets/${pid}`)
    await shot('07a-pos-step1', '#/pos')
    await js(`location.hash = '#/pos?customer=${cid}&pet=${pid}'`)
    await wait(900)
    await js(`[...document.querySelectorAll('.product-tile')].slice(0,4).forEach(b => b.click())`)
    await shot('07-pos')
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('ถัดไป: รับเงิน')).click()`)
    await wait(300)
    await js(`[...document.querySelectorAll('.method')].find(b => b.textContent.includes('QR')).click()`)
    await shot('08-payment')
    await shot('09-invoice', `#/invoices/${b.id}`)
    await shot('10-print', `#/print/invoice/${b.id}`)
    await shot('11-products', '#/products')
    await shot('12-finance-shift', '#/finance/shift')
    await shot('13-finance', '#/finance/overview')
    await shot('14-settings', '#/settings')
    await shot('15-vaccines', '#/vaccines')
    await call('auth.logout')
    await shot('16-login', '#/')
    await js('location.reload()')
    await wait(1200)
    await js('document.querySelector(".userpick button").click()')
    await shot('16-login')
    console.log('screens saved to', outDir)
  } catch (e) {
    console.error('SCREEN ERROR', e)
  }
  app.exit(0)
})

require('./main/index.js')
