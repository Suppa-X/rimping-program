import { app, dialog, shell, BrowserWindow } from 'electron'
import { join, extname, basename } from 'node:path'
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs'
import { all, one, insert, update, uid, audit, tx, today, now, nextDocNo, nextPetCode } from '../db'
import { requireUser, requirePerm } from '../auth'

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Deposit money a customer still has on account. */
export function depositBalance(customerId: string): number {
  const r = one<{ bal: number }>(
    `SELECT COALESCE(SUM(CASE
        WHEN kind = 'deposit' THEN amount
        WHEN kind = 'payment' AND method = 'deposit' THEN -amount
        WHEN kind = 'refund' AND method = 'deposit' THEN amount
        WHEN kind = 'refund' AND invoice_id IS NULL THEN -amount
        ELSE 0 END), 0) AS bal
     FROM payments WHERE customer_id = ?`,
    customerId
  )
  return Math.round((r?.bal ?? 0) * 100) / 100
}

/** Record a vaccination and work out its next due date from the vaccine type. */
export function recordVaccination(a: {
  pet_id: string
  vaccine_type_id?: string
  name?: string
  given_date?: string
  next_due_date?: string
  lot_no?: string
  vet_id?: string
  invoice_id?: string
  note?: string
}): string {
  const vt = a.vaccine_type_id ? one<any>('SELECT * FROM vaccine_types WHERE id = ?', a.vaccine_type_id) : undefined
  const given = a.given_date || today()
  const id = uid()
  insert('vaccinations', {
    id,
    pet_id: a.pet_id,
    vaccine_type_id: a.vaccine_type_id,
    name: a.name || vt?.name || 'วัคซีน',
    given_date: given,
    next_due_date: a.next_due_date || (vt ? addDays(given, vt.interval_days) : undefined),
    lot_no: a.lot_no,
    vet_id: a.vet_id,
    invoice_id: a.invoice_id,
    note: a.note
  })
  // An earlier shot of the same vaccine no longer needs a reminder.
  if (a.vaccine_type_id) {
    for (const prev of all<{ id: string }>(
      `SELECT id FROM vaccinations
       WHERE pet_id = ? AND vaccine_type_id = ? AND id <> ? AND done_followup = 0 AND given_date <= ?`,
      a.pet_id,
      a.vaccine_type_id,
      id,
      given
    )) {
      update('vaccinations', prev.id, { done_followup: 1 })
    }
  }
  return id
}

export const clinicApi = {
  /* ---------- customers ---------- */
  'customers.search': (a: { q?: string; limit?: number }) => {
    const q = `%${(a.q ?? '').trim()}%`
    return all(
      `SELECT c.*,
         (SELECT GROUP_CONCAT(p.name || COALESCE(' (' || p.code || ')', ''), ', ') FROM pets p WHERE p.customer_id = c.id AND p.active = 1) AS pet_names,
         (SELECT COALESCE(SUM(i.total - i.paid_amount),0) FROM invoices i
            WHERE i.customer_id = c.id AND i.status IN ('unpaid','partial')) AS outstanding
       FROM customers c
       WHERE c.active = 1 AND (
         c.name LIKE ?1 OR c.phone LIKE ?1 OR c.phone2 LIKE ?1 OR c.code LIKE ?1 OR
         EXISTS (SELECT 1 FROM pets p WHERE p.customer_id = c.id AND (p.name LIKE ?1 OR p.code LIKE ?1 OR p.microchip LIKE ?1) AND p.active = 1))
       ORDER BY c.updated_at DESC LIMIT ?2`,
      q,
      a.limit ?? 50
    )
  },

  'customers.get': (a: { id: string }) => {
    const c = one<any>('SELECT * FROM customers WHERE id = ?', a.id)
    if (!c) throw new Error('ไม่พบข้อมูลลูกค้า')
    const pets = all('SELECT * FROM pets WHERE customer_id = ? AND active = 1 ORDER BY created_at', a.id)
    const invoices = all(
      `SELECT i.*, p.name AS pet_name FROM invoices i LEFT JOIN pets p ON p.id = i.pet_id
       WHERE i.customer_id = ? ORDER BY i.issued_at DESC LIMIT 100`,
      a.id
    )
    const outstanding = one<{ v: number }>(
      `SELECT COALESCE(SUM(total - paid_amount),0) AS v FROM invoices
       WHERE customer_id = ? AND status IN ('unpaid','partial')`,
      a.id
    )!.v
    return { ...c, pets, invoices, outstanding, deposit_balance: depositBalance(a.id) }
  },

  'customers.save': (a: Record<string, any>) => {
    const u = requireUser()
    if (!a.name?.trim()) throw new Error('กรุณากรอกชื่อลูกค้า')
    return tx(() => {
      const row = {
        name: a.name.trim(),
        phone: a.phone?.trim(),
        phone2: a.phone2?.trim(),
        line_id: a.line_id?.trim(),
        address: a.address,
        tax_id: a.tax_id,
        province: a.province,
        postcode: a.postcode,
        member_since: a.member_since,
        member_expire: a.member_expire,
        note: a.note,
        pdpa_consent_at: a.pdpa_consent ? (a.pdpa_consent_at || now()) : null
      }
      if (a.id) {
        update('customers', a.id, row)
        audit(u.id, 'customer.update', 'customers', a.id)
        return a.id
      }
      const id = uid()
      insert('customers', { id, code: nextDocNo('C', 5), ...row })
      audit(u.id, 'customer.create', 'customers', id)
      return id
    })
  },

  /* ---------- pets ---------- */
  'pets.get': (a: { id: string }) => {
    const p = one<any>(
      `SELECT p.*, c.name AS owner_name, c.phone AS owner_phone
       FROM pets p JOIN customers c ON c.id = p.customer_id WHERE p.id = ?`,
      a.id
    )
    if (!p) throw new Error('ไม่พบข้อมูลสัตว์เลี้ยง')
    const visits = all(
      `SELECT v.*, u.display_name AS vet_name, i.invoice_no FROM visits v
       LEFT JOIN users u ON u.id = v.vet_id LEFT JOIN invoices i ON i.id = v.invoice_id
       WHERE v.pet_id = ? ORDER BY v.visit_date DESC, v.created_at DESC`,
      a.id
    )
    const vaccinations = all(
      `SELECT x.*, u.display_name AS vet_name FROM vaccinations x LEFT JOIN users u ON u.id = x.vet_id
       WHERE x.pet_id = ? ORDER BY x.given_date DESC`,
      a.id
    )
    const invoices = all(
      'SELECT * FROM invoices WHERE pet_id = ? ORDER BY issued_at DESC LIMIT 50',
      a.id
    )
    const attachments = all('SELECT * FROM attachments WHERE pet_id = ? ORDER BY created_at DESC', a.id)
    const appointments = all(
      `SELECT * FROM appointments WHERE pet_id = ? AND status = 'pending' ORDER BY appt_date, appt_time`,
      a.id
    )
    const admission = one(`SELECT * FROM admissions WHERE pet_id = ? AND status = 'admitted'`, a.id)
    return { ...p, visits, vaccinations, invoices, attachments, appointments, admission }
  },

  /* ---------- attachments (X-ray, lab results, photos) ---------- */
  'attachments.add': async (a: { pet_id: string; visit_id?: string; kind?: string }) => {
    const u = requireUser()
    const win = BrowserWindow.getFocusedWindow()
    const pick = await dialog.showOpenDialog(win!, {
      title: 'เลือกไฟล์แนบ (รูป X-ray, ผลแล็บ, PDF)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'รูปภาพ / PDF', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf'] }]
    })
    if (pick.canceled) return 0
    const dir = join(app.getPath('userData'), 'attachments')
    mkdirSync(dir, { recursive: true })
    for (const file of pick.filePaths) {
      const id = uid()
      const storedAs = `${id}${extname(file).toLowerCase()}`
      copyFileSync(file, join(dir, storedAs))
      insert('attachments', { id, pet_id: a.pet_id, visit_id: a.visit_id, kind: a.kind, file_name: basename(file), stored_as: storedAs, created_by: u.id })
      audit(u.id, 'attachment.add', 'attachments', id, { file: basename(file) })
    }
    return pick.filePaths.length
  },

  'attachments.thumb': (a: { id: string }) => {
    const f = one<any>('SELECT * FROM attachments WHERE id = ?', a.id)
    if (!f || f.stored_as.endsWith('.pdf')) return null
    const mime = f.stored_as.endsWith('.png') ? 'image/png' : f.stored_as.endsWith('.gif') ? 'image/gif' : 'image/jpeg'
    return `data:${mime};base64,${readFileSync(join(app.getPath('userData'), 'attachments', f.stored_as)).toString('base64')}`
  },

  'attachments.open': (a: { id: string }) => {
    const f = one<any>('SELECT * FROM attachments WHERE id = ?', a.id)
    if (f) shell.openPath(join(app.getPath('userData'), 'attachments', f.stored_as))
    return true
  },

  /* ---------- appointments ---------- */
  'appointments.list': (a: { from?: string; to?: string; status?: string }) =>
    all(
      `SELECT ap.*, p.name AS pet_name, p.species, p.code AS pet_code, c.name AS owner_name, c.phone, c.line_id,
              u.display_name AS vet_name
       FROM appointments ap JOIN pets p ON p.id = ap.pet_id JOIN customers c ON c.id = ap.customer_id
       LEFT JOIN users u ON u.id = ap.vet_id
       WHERE ap.appt_date BETWEEN ?1 AND ?2 AND (?3 = '' OR ap.status = ?3)
       ORDER BY ap.appt_date, COALESCE(ap.appt_time, '99')`,
      a.from || '0000-01-01',
      a.to || '9999-12-31',
      a.status ?? ''
    ),

  'appointments.get': (a: { id: string }) =>
    one(
      `SELECT ap.*, p.name AS pet_name, p.species, p.breed, p.sex, p.code AS pet_code, c.name AS owner_name, c.phone,
              u.display_name AS vet_name
       FROM appointments ap JOIN pets p ON p.id = ap.pet_id JOIN customers c ON c.id = ap.customer_id
       LEFT JOIN users u ON u.id = ap.vet_id WHERE ap.id = ?`,
      a.id
    ),

  'appointments.save': (a: Record<string, any>) => {
    const u = requireUser()
    const pet = one<any>('SELECT * FROM pets WHERE id = ?', a.pet_id)
    if (!pet) throw new Error('กรุณาเลือกสัตว์เลี้ยง')
    if (!a.appt_date) throw new Error('กรุณาเลือกวันนัด')
    if (!a.topic?.trim()) throw new Error('กรุณาระบุหัวข้อนัด')
    const row = {
      pet_id: pet.id,
      customer_id: pet.customer_id,
      appt_date: a.appt_date,
      appt_time: a.appt_time,
      topic: a.topic.trim(),
      detail: a.detail,
      vet_id: a.vet_id || null,
      visit_id: a.visit_id
    }
    if (a.id) {
      update('appointments', a.id, row)
      audit(u.id, 'appointment.update', 'appointments', a.id)
      return a.id
    }
    const id = uid()
    insert('appointments', { id, ...row, created_by: u.id })
    audit(u.id, 'appointment.create', 'appointments', id, { date: a.appt_date, topic: a.topic })
    return id
  },

  'appointments.setStatus': (a: { id: string; status: string }) => {
    const u = requireUser()
    if (!['pending', 'done', 'cancelled', 'no_show'].includes(a.status)) throw new Error('สถานะไม่ถูกต้อง')
    update('appointments', a.id, { status: a.status })
    audit(u.id, 'appointment.status', 'appointments', a.id, { status: a.status })
    return true
  },

  'appointments.markCalled': (a: { id: string }) => {
    const u = requireUser()
    update('appointments', a.id, { called_at: now() })
    audit(u.id, 'appointment.called', 'appointments', a.id)
    return true
  },

  'pets.save': (a: Record<string, any>) => {
    const u = requireUser()
    if (!a.name?.trim()) throw new Error('กรุณากรอกชื่อสัตว์เลี้ยง')
    if (!a.species?.trim()) throw new Error('กรุณาระบุชนิดสัตว์')
    return tx(() => {
      const code = a.code?.trim()
      if (code && one('SELECT 1 FROM pets WHERE code = ? AND id <> ?', code, a.id ?? '')) throw new Error(`รหัสสัตว์ ${code} ถูกใช้แล้ว`)
      const row = {
        customer_id: a.customer_id,
        code: code || undefined,
        name: a.name.trim(),
        species: a.species.trim(),
        breed: a.breed,
        sex: a.sex || 'U',
        neutered: !!a.neutered,
        birth_date: a.birth_date,
        color: a.color,
        microchip: a.microchip,
        weight_kg: a.weight_kg === '' || a.weight_kg == null ? null : Number(a.weight_kg),
        allergy_note: a.allergy_note,
        warning_note: a.warning_note,
        note: a.note,
        deceased: !!a.deceased
      }
      if (a.id) {
        update('pets', a.id, row)
        audit(u.id, 'pet.update', 'pets', a.id)
        return a.id
      }
      const id = uid()
      insert('pets', { id, ...row, code: row.code ?? nextPetCode() })
      audit(u.id, 'pet.create', 'pets', id)
      return id
    })
  },

  /* ---------- visits (SOAP) ---------- */
  'visits.save': (a: Record<string, any>) => {
    const u = requirePerm('emr.edit')
    return tx(() => {
      const num = (v: any): number | null => (v === '' || v == null ? null : Number(v))
      const row = {
        pet_id: a.pet_id,
        vet_id: a.vet_id || (u.is_vet ? u.id : null),
        visit_date: a.visit_date || today(),
        weight_kg: num(a.weight_kg),
        temp_c: num(a.temp_c),
        heart_rate: num(a.heart_rate),
        resp_rate: num(a.resp_rate),
        subjective: a.subjective,
        objective: a.objective,
        assessment: a.assessment,
        plan: a.plan,
        history: a.history,
        blood_result: a.blood_result,
        xray: a.xray,
        lab_other: a.lab_other,
        diff_diag: a.diff_diag,
        treatment: a.treatment,
        prescription: a.prescription
      }
      let id = a.id as string | undefined
      if (id) {
        update('visits', id, row)
        audit(u.id, 'visit.update', 'visits', id)
      } else {
        id = uid()
        insert('visits', { id, ...row, created_by: u.id })
        audit(u.id, 'visit.create', 'visits', id)
      }
      if (row.weight_kg) update('pets', a.pet_id, { weight_kg: row.weight_kg })
      // A visit started from the queue moves the patient on to payment.
      if (a.queue_id) update('queue', a.queue_id, { visit_id: id, vet_id: row.vet_id, status: 'to_pay' })
      return id
    })
  },

  'visits.get': (a: { id: string }) => one('SELECT * FROM visits WHERE id = ?', a.id),

  /* ---------- today's queue ---------- */
  'queue.today': () =>
    all(
      `SELECT q.*, p.name AS pet_name, p.species, p.allergy_note, p.warning_note,
              c.name AS owner_name, c.phone, u.display_name AS vet_name, i.invoice_no, i.total AS invoice_total
       FROM queue q JOIN pets p ON p.id = q.pet_id JOIN customers c ON c.id = q.customer_id
       LEFT JOIN users u ON u.id = q.vet_id LEFT JOIN invoices i ON i.id = q.invoice_id
       WHERE q.queue_date = ? AND q.status <> 'cancelled' ORDER BY q.queue_no`,
      today()
    ),

  'queue.add': (a: { pet_id: string; reason?: string }) => {
    const u = requireUser()
    const pet = one<any>('SELECT * FROM pets WHERE id = ?', a.pet_id)
    if (!pet) throw new Error('ไม่พบสัตว์เลี้ยง')
    return tx(() => {
      const d = today()
      const dup = one<any>(
        "SELECT queue_no FROM queue WHERE pet_id = ? AND queue_date = ? AND status IN ('waiting','in_exam','to_pay')",
        a.pet_id,
        d
      )
      if (dup) throw new Error(`${pet.name} อยู่ในคิวแล้ว (คิวที่ ${dup.queue_no})`)
      const no = one<{ n: number }>('SELECT COALESCE(MAX(queue_no),0) + 1 AS n FROM queue WHERE queue_date = ?', d)!.n
      const id = uid()
      insert('queue', {
        id,
        queue_no: no,
        queue_date: d,
        customer_id: pet.customer_id,
        pet_id: pet.id,
        reason: a.reason,
        status: 'waiting',
        created_by: u.id
      })
      audit(u.id, 'queue.add', 'queue', id, { queue_no: no })
      return { id, queue_no: no }
    })
  },

  'queue.setStatus': (a: { id: string; status: string; vet_id?: string }) => {
    const u = requireUser()
    if (!['waiting', 'in_exam', 'to_pay', 'done', 'cancelled'].includes(a.status)) throw new Error('สถานะไม่ถูกต้อง')
    update('queue', a.id, { status: a.status, vet_id: a.vet_id })
    audit(u.id, 'queue.status', 'queue', a.id, { status: a.status })
    return true
  },

  /* ---------- vaccines ---------- */
  'vaccineTypes.list': () =>
    all(
      `SELECT v.*, p.name AS product_name FROM vaccine_types v LEFT JOIN products p ON p.id = v.product_id
       WHERE v.active = 1 ORDER BY v.name`
    ),

  'vaccineTypes.save': (a: Record<string, any>) => {
    const u = requirePerm('settings')
    const row = {
      name: a.name,
      species: a.species,
      interval_days: Number(a.interval_days) || 365,
      product_id: a.product_id || null,
      active: a.active ?? true
    }
    if (a.id) {
      update('vaccine_types', a.id, row)
      audit(u.id, 'vaccine_type.update', 'vaccine_types', a.id)
      return a.id
    }
    const id = uid()
    insert('vaccine_types', { id, ...row })
    audit(u.id, 'vaccine_type.create', 'vaccine_types', id)
    return id
  },

  'vaccinations.add': (a: Record<string, any>) => {
    const u = requireUser()
    return tx(() => {
      const id = recordVaccination({ ...(a as any), vet_id: a.vet_id || (u.is_vet ? u.id : undefined) })
      audit(u.id, 'vaccination.create', 'vaccinations', id)
      return id
    })
  },

  'vaccinations.markDone': (a: { id: string }) => {
    const u = requireUser()
    update('vaccinations', a.id, { done_followup: 1 })
    audit(u.id, 'vaccination.followup_done', 'vaccinations', a.id)
    return true
  },

  /** Pets whose next vaccine/preventive is due within `days` (overdue included). */
  'vaccinations.due': (a: { days?: number }) =>
    all(
      `SELECT x.id, x.name, x.next_due_date, x.given_date, p.id AS pet_id, p.name AS pet_name, p.species,
              c.id AS customer_id, c.name AS owner_name, c.phone, c.line_id
       FROM vaccinations x JOIN pets p ON p.id = x.pet_id JOIN customers c ON c.id = p.customer_id
       WHERE x.done_followup = 0 AND x.next_due_date IS NOT NULL AND p.deceased = 0 AND p.active = 1
         AND x.next_due_date <= date('now','localtime', ?)
       ORDER BY x.next_due_date`,
      `+${a.days ?? 14} days`
    )
}
