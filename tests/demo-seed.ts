// Demo data shared by the desktop demo (npm run demo) and the web demo (npm run web).
// Demo accounts (PIN):  owner = 1111 (เจ้าของร้าน/หมอ) · manager = 2222 (ผู้จัดการ) · staff = 3333 (พนักงาน, ลดได้ 5%)
type Call = (m: string, a?: unknown) => Promise<any>

export const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


export async function seedDemo(call: Call, backupDir: string): Promise<void> {
  await call('auth.setupOwner', { username: 'owner', display_name: 'หมอปิง (เจ้าของ)', pin: '1111', is_vet: true })
  const me = await call('auth.login', { username: 'owner', pin: '1111' })
  await call('users.save', { username: 'manager', display_name: 'พี่นก (ผู้จัดการ)', role: 'manager', pin: '2222', max_discount_pct: 20, is_vet: false })
  await call('users.save', { username: 'staff', display_name: 'น้องฝน (หน้าร้าน)', role: 'staff', pin: '3333', max_discount_pct: 5, is_vet: false })
  await call('settings.save', {
    shop_address: '99 ถ.เจริญราษฎร์ ต.วัดเกต อ.เมือง จ.เชียงใหม่ 50000 (ตัวอย่าง)',
    shop_phone: '053-000-000',
    promptpay_id: '0800000000',
    backup_dir: backupDir
  })

  const P = (a: any): Promise<string> => call('products.save', { unit: 'ชิ้น', track_stock: true, vat_type: 'vat', ...a })
  const food1 = await P({ name: 'Royal Canin Mini Adult 2kg', category: 'food', price: 690, unit: 'ถุง', opening_qty: 12, opening_cost: 520, min_stock: 4 })
  await P({ name: 'Royal Canin Kitten 2kg', category: 'food', price: 750, unit: 'ถุง', opening_qty: 3, opening_cost: 560, min_stock: 4 })
  await P({ name: 'อาหารเปียกแมว Whiskas 85g', category: 'food', price: 18, unit: 'ซอง', opening_qty: 120, opening_cost: 11, min_stock: 24 })
  const amox = await P({ name: 'Amoxicillin 250mg', category: 'medicine', price: 10, unit: 'เม็ด', opening_qty: 400, opening_cost: 3, min_stock: 100, needs_vet: false, sku: '8850001000011', drug_group: 'ยาปฏิชีวนะ (Antibiotic)', label_th: 'กินครั้งละ 1 เม็ด วันละ 2 ครั้ง เช้า-เย็น หลังอาหาร', label_en: '1 tablet twice daily after meals' })
  await P({ name: 'Metronidazole 200mg', category: 'medicine', price: 8, unit: 'เม็ด', opening_qty: 250, opening_cost: 2, min_stock: 50, drug_group: 'ยาฆ่าเชื้อ/ท้องเสีย', label_th: 'กินครั้งละ 1/2 เม็ด วันละ 2 ครั้ง หลังอาหาร', label_en: '1/2 tablet twice daily after meals' })
  await P({ name: 'Tramadol 50mg', category: 'medicine', price: 15, unit: 'เม็ด', opening_qty: 100, opening_cost: 4, min_stock: 20, controlled: true, drug_group: 'ยาแก้ปวด (ยาควบคุม)', label_th: 'กินครั้งละ 1/2 เม็ด ทุก 12 ชั่วโมง เมื่อปวด', label_en: '1/2 tablet every 12 hours for pain' })
  await P({ name: 'Ketamine 50mg/ml (ยาสลบ)', category: 'medicine', price: 150, unit: 'ml', opening_qty: 30, opening_cost: 40, min_stock: 10, controlled: true, needs_vet: true })
  await P({ name: 'ค่าห้องพัก Admit (ต่อวัน)', category: 'boarding', price: 300, unit: 'วัน', track_stock: false })
  await P({ name: 'ค่าฝากเลี้ยง (ต่อวัน)', category: 'boarding', price: 200, unit: 'วัน', track_stock: false })
  await P({ name: 'ค่าดูแล/ป้อนยา Admit (ต่อวัน)', category: 'boarding', price: 150, unit: 'วัน', track_stock: false })
  await P({ name: 'ให้น้ำเกลือ (Fluid therapy)', category: 'procedure', price: 350, unit: 'ครั้ง', track_stock: false, needs_vet: true })
  await P({ name: 'อาบน้ำ-ตัดขน สุนัขเล็ก', category: 'grooming', price: 400, unit: 'ครั้ง', track_stock: false })
  await P({ name: 'อาบน้ำ-ตัดขน สุนัขใหญ่', category: 'grooming', price: 700, unit: 'ครั้ง', track_stock: false })
  const nexgard = await P({ name: 'NexGard Spectra (7.5–15kg)', category: 'medicine', price: 450, unit: 'เม็ด', opening_qty: 20, opening_cost: 330, min_stock: 6 })
  await P({ name: 'Revolution Plus แมว', category: 'medicine', price: 420, unit: 'หลอด', opening_qty: 2, opening_cost: 300, min_stock: 5 })
  await P({ name: 'ปลอกคอกันเลีย L', category: 'supply', price: 150, unit: 'อัน', opening_qty: 8, opening_cost: 60, min_stock: 3 })
  await P({ name: 'ทรายแมวเต้าหู้ 6L', category: 'supply', price: 159, unit: 'ถุง', opening_qty: 15, opening_cost: 105, min_stock: 5 })
  await P({ name: 'ผ่าตัดทำหมันแมวเพศเมีย', category: 'procedure', price: 1500, unit: 'ครั้ง', track_stock: false, needs_vet: true })
  await P({ name: 'ขูดหินปูน', category: 'procedure', price: 1200, unit: 'ครั้ง', track_stock: false, needs_vet: true })

  const prods = await call('products.list', {})
  const pid = (name: string): string => prods.find((p: any) => p.name === name).id
  for (const name of ['วัคซีนพิษสุนัขบ้า', 'วัคซีนรวมสุนัข (5 โรค)', 'วัคซีนรวมแมว (4 โรค)'])
    await call('stock.receive', { product_id: pid(name), qty: 20, unit_cost: name.includes('พิษ') ? 90 : 180, note: 'ยอดยกมา' })

  const C = async (c: any, pets: any[]): Promise<{ cid: string; pets: string[] }> => {
    const cid = await call('customers.save', { pdpa_consent: true, ...c })
    const ids: string[] = []
    for (const p of pets) ids.push(await call('pets.save', { customer_id: cid, sex: 'U', ...p }))
    return { cid, pets: ids }
  }
  const somsri = await C({ name: 'คุณสมศรี ใจดี', phone: '0811111111', line_id: 'somsri.j' }, [
    { name: 'ข้าวตู', species: 'สุนัข', breed: 'ชิสุ', sex: 'M', neutered: true, birth_date: '2021-03-01', weight_kg: 6.2, allergy_note: 'เพนิซิลลิน' },
    { name: 'มะลิ', species: 'แมว', breed: 'ไทย', sex: 'F', birth_date: '2023-06-10', weight_kg: 3.4 }
  ])
  const somchai = await C({ name: 'คุณสมชาย รักหมา', phone: '0822222222' }, [
    { name: 'บราวนี่', species: 'สุนัข', breed: 'โกลเด้น รีทรีฟเวอร์', sex: 'M', birth_date: '2019-01-15', weight_kg: 31, warning_note: 'ตื่นกลัว ระวังกัดตอนตัดเล็บ' }
  ])
  const nida = await C({ name: 'คุณนิดา แมวเยอะ', phone: '0833333333', line_id: 'nida_cat' }, [
    { name: 'ส้มโอ', species: 'แมว', breed: 'ส้ม', sex: 'M', neutered: true, birth_date: '2020-08-01', weight_kg: 5.1 },
    { name: 'ถั่วดำ', species: 'แมว', breed: 'ดำ', sex: 'F', birth_date: '2024-02-20', weight_kg: 2.9 },
    { name: 'มอมแมม', species: 'แมว', breed: 'สามสี', sex: 'F', neutered: true, birth_date: '2018-05-05', weight_kg: 4.0 }
  ])
  const pond = await C({ name: 'คุณปอนด์ กระต่ายน้อย', phone: '0844444444' }, [
    { name: 'บันนี่', species: 'กระต่าย', breed: 'ฮอลแลนด์ลอป', sex: 'F', birth_date: '2024-09-01', weight_kg: 1.6 }
  ])
  await C({ name: 'คุณวิภา (ยังไม่มีสัตว์)', phone: '0855555555' }, [])

  // Vaccines given ~a year ago so reminders show up as due / overdue.
  const types = await call('vaccineTypes.list')
  const vt = (name: string): string => types.find((t: any) => t.name === name).id
  await call('vaccinations.add', { pet_id: somsri.pets[0], vaccine_type_id: vt('พิษสุนัขบ้า'), given_date: daysAgo(370), vet_id: me.id })
  await call('vaccinations.add', { pet_id: somchai.pets[0], vaccine_type_id: vt('รวม 5 โรค (สุนัข)'), given_date: daysAgo(360), vet_id: me.id })
  await call('vaccinations.add', { pet_id: nida.pets[0], vaccine_type_id: vt('รวม 4 โรค (แมว)'), given_date: daysAgo(355), vet_id: me.id })
  await call('vaccinations.add', { pet_id: nida.pets[1], vaccine_type_id: vt('ถ่ายพยาธิ'), given_date: daysAgo(95), vet_id: me.id })
  await call('vaccinations.add', { pet_id: pond.pets[0], vaccine_type_id: vt('ป้องกันเห็บหมัด'), given_date: daysAgo(28), vet_id: me.id })

  await call('visits.save', {
    pet_id: somsri.pets[0], visit_date: daysAgo(30), vet_id: me.id, weight_kg: 6.0, temp_c: 38.6,
    subjective: 'คันบริเวณหู เกาบ่อย', objective: 'หูซ้ายแดง มีขี้หูสีน้ำตาล', assessment: 'Otitis externa', plan: 'ล้างหู ยาหยอดหู 7 วัน'
  })

  await call('shifts.open', { opening_cash: 2000 })
  const v1 = await call('visits.save', {
    pet_id: somsri.pets[0], vet_id: me.id, weight_kg: 6.4, temp_c: 39.4, heart_rate: 120, resp_rate: 28,
    subjective: 'ไม่กินอาหาร 2 วัน อาเจียน 1 ครั้ง', objective: 'ขาดน้ำเล็กน้อย ท้องกดเจ็บ', assessment: 'Gastroenteritis',
    plan: 'ให้น้ำเกลือใต้ผิวหนัง ยาลดอาเจียน Amoxicillin 7 วัน นัดดูอาการ 3 วัน'
  })
  await call('pos.checkout', {
    customer_id: somsri.cid, pet_id: somsri.pets[0], visit_id: v1,
    items: [
      { product_id: pid('ค่าตรวจรักษา'), qty: 1, unit_price: 200, vet_id: me.id },
      { product_id: pid('ฉีดยา'), qty: 2, unit_price: 150, vet_id: me.id },
      { product_id: pid('วัคซีนพิษสุนัขบ้า'), qty: 1, unit_price: 300, vet_id: me.id },
      { product_id: amox, qty: 14, unit_price: 10 }
    ],
    bill_discount: 0,
    payments: [{ method: 'promptpay', amount: 940 }]
  })
  await call('pos.checkout', {
    customer_id: somchai.cid, pet_id: somchai.pets[0],
    items: [
      { product_id: nexgard, qty: 1, unit_price: 450 },
      { product_id: food1, qty: 2, unit_price: 690 }
    ],
    bill_discount: 30,
    payments: [{ method: 'cash', amount: 1800 }]
  })
  await call('deposits.add', { customer_id: nida.cid, method: 'transfer', amount: 1000, note: 'มัดจำผ่าตัดทำหมันถั่วดำ' })
  await call('pos.checkout', {
    customer_id: nida.cid, pet_id: nida.pets[0],
    items: [
      { product_id: pid('ค่าตรวจรักษา'), qty: 1, unit_price: 200, vet_id: me.id },
      { product_id: pid('ขูดหินปูน'), qty: 1, unit_price: 1200, vet_id: me.id }
    ],
    bill_discount: 0,
    payments: [{ method: 'cash', amount: 600 }]
  })
  await call('pos.checkout', { items: [{ product_id: pid('ทรายแมวเต้าหู้ 6L'), qty: 2, unit_price: 159 }], bill_discount: 0, payments: [{ method: 'cash', amount: 318 }] })

  // A year of history so the executive trends have data (demo only).
  await call('system.demoHistory', { months: 12 })

  // Admit: one sick cat for 3 days, one dog boarding.
  const all2 = await call('products.list', {})
  const pid2 = (name: string): string => all2.find((p: any) => p.name === name).id
  const ad1 = await call('admissions.admit', { pet_id: nida.pets[2], kind: 'ipd', cage: 'A1', reason: 'ไตวาย ให้น้ำเกลือ', vet_id: me.id })
  for (const back of [2, 1, 0]) {
    const day = daysAgo(back)
    await call('admissions.addCharge', { admission_id: ad1, product_id: pid2('ค่าห้องพัก Admit (ต่อวัน)'), qty: 1, charge_date: day })
    await call('admissions.addCharge', { admission_id: ad1, product_id: pid2('ให้น้ำเกลือ (Fluid therapy)'), qty: 1, charge_date: day, vet_id: me.id })
    if (back > 0) await call('admissions.addCharge', { admission_id: ad1, product_id: pid2('Metronidazole 200mg'), qty: 2, charge_date: day })
  }
  await call('deposits.add', { customer_id: nida.cid, method: 'cash', amount: 2000, note: 'มัดจำ Admit มอมแมม' })
  const ad2 = await call('admissions.admit', { pet_id: somchai.pets[0], kind: 'boarding', cage: 'B2', reason: 'ฝากเลี้ยงช่วงเจ้าของไปต่างจังหวัด' })
  await call('admissions.addCharge', { admission_id: ad2, product_id: pid2('ค่าฝากเลี้ยง (ต่อวัน)'), qty: 1, charge_date: daysAgo(1) })

  // Appointments: today, tomorrow, and one missed.
  await call('appointments.save', { pet_id: somsri.pets[0], appt_date: daysAgo(0), appt_time: '14:00', topic: 'ตรวจติดตามอาการ', detail: 'ดูอาการท้องเสีย', vet_id: me.id })
  await call('appointments.save', { pet_id: pond.pets[0], appt_date: daysAgo(-1), appt_time: '10:30', topic: 'ทำหมัน', detail: 'งดอาหารและน้ำก่อนมา 8 ชั่วโมง', vet_id: me.id })
  await call('appointments.save', { pet_id: nida.pets[1], appt_date: daysAgo(3), topic: 'นัดวัคซีน', detail: 'วัคซีนรวมแมวเข็มที่ 2' })
  // More bookings spread over the month so the calendar has something to show.
  const spread: [string, number, string, string][] = [
    [somchai.pets[0], 0, '10:00', 'นัดวัคซีน'],
    [nida.pets[0], 0, '16:30', 'ตัดไหม/ทำแผล'],
    [pond.pets[0], 2, '09:30', 'ตรวจเลือด'],
    [nida.pets[2], 4, '13:00', 'ตรวจติดตามอาการ'],
    [somsri.pets[0], 6, '11:00', 'ขูดหินปูน'],
    [somchai.pets[0], 9, '15:00', 'ถ่ายพยาธิ/หยดเห็บหมัด'],
    [nida.pets[1], 13, '10:00', 'นัดวัคซีน'],
    [pond.pets[0], 20, '14:30', 'ตรวจติดตามอาการ']
  ]
  for (const [pet_id, ahead, appt_time, topic] of spread)
    await call('appointments.save', { pet_id, appt_date: daysAgo(-ahead), appt_time, topic, vet_id: me.id })
}

/** Put a few patients in today's queue (once per day) so the board shows each stage. */
export async function seedQueue(call: Call): Promise<void> {
  if ((await call('queue.today')).length) return
  if (!(await call('shifts.current'))) await call('shifts.open', { opening_cash: 2000 })
  const me = await call('auth.me')
  const pets: any[] = []
  for (const c of await call('customers.search', { q: '', limit: 20 })) pets.push(...(await call('customers.get', { id: c.id })).pets)
  const plan = [
    { reason: 'ฉีดวัคซีน', status: 'waiting' },
    { reason: 'ตรวจรักษา', status: 'waiting' },
    { reason: 'ตรวจติดตามอาการ', status: 'in_exam' },
    { reason: 'ถ่ายพยาธิ/หยดเห็บหมัด', status: 'to_pay' }
  ]
  for (const [i, p] of plan.entries()) {
    if (!pets[i]) break
    const q = await call('queue.add', { pet_id: pets[i].id, reason: p.reason })
    if (p.status !== 'waiting') await call('queue.setStatus', { id: q.id, status: p.status, vet_id: me.id })
  }
}
