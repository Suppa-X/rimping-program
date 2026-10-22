import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { api, SPECIES, todayStr, addDays, addMonths, APPT_TOPICS, longDate } from '../api'
import { Modal, Field, useAction, useApi, useSession } from '../ui'

export function CustomerForm(props: { initial?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<any>({
    pdpa_consent: !!props.initial?.pdpa_consent_at,
    ...(props.initial ?? {})
  })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (): Promise<void> => {
    const id = await act(() => api<string>('customers.save', f), 'บันทึกข้อมูลลูกค้าแล้ว')
    if (id) props.onSaved(id)
  }
  return (
    <Modal
      wide
      title={f.id ? 'แก้ไขข้อมูลลูกค้า' : 'ลูกค้าใหม่'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="grid g2">
        <Field label="ชื่อ-นามสกุล" required>
          <input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="LINE ID">
          <input value={f.line_id ?? ''} onChange={(e) => set('line_id', e.target.value)} />
        </Field>
        <Field label="มือถือ">
          <input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="โทรศัพท์อื่น">
          <input value={f.phone2 ?? ''} onChange={(e) => set('phone2', e.target.value)} />
        </Field>
      </div>
      <Field label="ที่อยู่">
        <input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ" />
      </Field>
      <div className="grid g3">
        <Field label="จังหวัด">
          <input value={f.province ?? ''} onChange={(e) => set('province', e.target.value)} placeholder="เชียงใหม่" />
        </Field>
        <Field label="รหัสไปรษณีย์">
          <input value={f.postcode ?? ''} onChange={(e) => set('postcode', e.target.value)} />
        </Field>
        <Field label="เลขผู้เสียภาษี (ใบกำกับเต็มรูป)">
          <input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} />
        </Field>
        <Field label="สมัครสมาชิกเมื่อ">
          <input type="date" value={f.member_since ?? ''} onChange={(e) => setF((x: any) => ({ ...x, member_since: e.target.value, member_expire: x.member_expire || (e.target.value ? addMonths(e.target.value, 12) : '') }))} />
        </Field>
        <Field label="สมาชิกหมดอายุ">
          <input type="date" value={f.member_expire ?? ''} onChange={(e) => set('member_expire', e.target.value)} />
        </Field>
        <Field label="หมายเหตุ">
          <input value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!f.pdpa_consent} onChange={(e) => set('pdpa_consent', e.target.checked)} />
        ลูกค้ายินยอมให้ร้านเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการรักษาและแจ้งเตือนนัดหมาย (PDPA)
      </label>
    </Modal>
  )
}

export function PetForm(props: { customerId: string; initial?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<any>({ species: 'สุนัข', sex: 'U', ...(props.initial ?? {}), customer_id: props.customerId })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (): Promise<void> => {
    const id = await act(() => api<string>('pets.save', f), 'บันทึกข้อมูลสัตว์เลี้ยงแล้ว')
    if (id) props.onSaved(id)
  }
  return (
    <Modal
      wide
      title={f.id ? 'แก้ไขข้อมูลสัตว์เลี้ยง' : 'เพิ่มสัตว์เลี้ยง'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="grid g3">
        <Field label="ชื่อสัตว์" required>
          <input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="ชนิด" required>
          <input list="species" value={f.species ?? ''} onChange={(e) => set('species', e.target.value)} />
          <datalist id="species">
            {SPECIES.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="รหัสสัตว์ (เว้นว่าง = ออกให้อัตโนมัติ)">
          <input value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="69/123" />
        </Field>
        <Field label="พันธุ์">
          <input value={f.breed ?? ''} onChange={(e) => set('breed', e.target.value)} />
        </Field>
        <Field label="สี/ลักษณะ">
          <input value={f.color ?? ''} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field label="เพศ">
          <select value={f.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="M">ผู้</option>
            <option value="F">เมีย</option>
            <option value="U">ไม่ระบุ</option>
          </select>
        </Field>
        <Field label="วันเกิด (โดยประมาณ)">
          <input type="date" max={todayStr()} value={f.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value)} />
        </Field>
        <Field label="น้ำหนัก (กก.)">
          <input type="number" step="0.01" value={f.weight_kg ?? ''} onChange={(e) => set('weight_kg', e.target.value)} />
        </Field>
        <Field label="เลขไมโครชิป">
          <input value={f.microchip ?? ''} onChange={(e) => set('microchip', e.target.value)} />
        </Field>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={!!f.neutered} onChange={(e) => set('neutered', e.target.checked)} /> ทำหมันแล้ว
        </label>
        {f.id && (
          <label className="check">
            <input type="checkbox" checked={!!f.deceased} onChange={(e) => set('deceased', e.target.checked)} /> เสียชีวิตแล้ว
          </label>
        )}
      </div>
      <div className="grid g2">
        <Field label="⚠️ แพ้ยา (Drug allergy) / แพ้อาหาร">
          <input value={f.allergy_note ?? ''} onChange={(e) => set('allergy_note', e.target.value)} />
        </Field>
        <Field label="⚠️ ข้อควรระวัง (เช่น ดุ กัด)">
          <input value={f.warning_note ?? ''} onChange={(e) => set('warning_note', e.target.value)} />
        </Field>
      </div>
      <Field label="รายละเอียดอื่น ๆ">
        <textarea value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </Modal>
  )
}

const EXAM_LEFT: [string, string, string][] = [
  ['subjective', 'Chief Complaint', 'อาการที่เจ้าของแจ้ง'],
  ['history', 'History Taking', 'ประวัติ (กินอาหาร ขับถ่าย วัคซีน ยาที่ได้)'],
  ['objective', 'Physical Exam', 'ผลตรวจร่างกาย'],
  ['blood_result', 'Blood Result', 'ผลเลือด'],
  ['xray', 'X-ray', 'ผล X-ray / Ultrasound'],
  ['lab_other', 'Lab อื่น ๆ', 'ผลแล็บอื่น ๆ']
]
const EXAM_RIGHT: [string, string, string][] = [
  ['diff_diag', 'Diff. Diag', 'การวินิจฉัยแยกโรค'],
  ['assessment', 'Diagnosis', 'การวินิจฉัย'],
  ['treatment', 'Tx', 'การรักษาที่ทำ'],
  ['prescription', 'Rx', 'ยาที่จ่ายกลับบ้าน'],
  ['plan', 'Plan', 'แผน / คำแนะนำ']
]

/** Common phrases a vet can tap instead of typing (a free alternative to AI note-writing). */
const PHRASES: Record<string, string[]> = {
  subjective: ['ไม่กินอาหาร', 'อาเจียน', 'ท้องเสีย', 'ซึม', 'ไอ/จาม', 'คันผิวหนัง', 'เกาหู', 'ขาเจ็บ เดินกะเผลก', 'ปัสสาวะผิดปกติ', 'มาฉีดวัคซีนตามนัด'],
  history: ['วัคซีนครบ', 'วัคซีนไม่ครบ', 'ถ่ายพยาธิแล้ว', 'กินอาหารเม็ด', 'เลี้ยงในบ้าน', 'เลี้ยงปล่อย', 'เคยเป็นมาก่อน'],
  objective: ['BCS 3/5', 'เยื่อเมือกชมพู', 'CRT < 2 วินาที', 'ขาดน้ำเล็กน้อย (~5%)', 'ท้องกดเจ็บ', 'ฟังปอดปกติ', 'หูอักเสบ', 'ผิวหนังแดง มีรังแค', 'ปกติทุกระบบ'],
  assessment: ['Gastroenteritis', 'Otitis externa', 'Dermatitis', 'URTI', 'Healthy — vaccination', 'Wound'],
  treatment: ['ฉีดยาลดอาเจียน', 'ให้น้ำเกลือใต้ผิวหนัง', 'ฉีดยาปฏิชีวนะ', 'ล้างหู', 'ทำแผล', 'ฉีดวัคซีน'],
  prescription: ['ยาปฏิชีวนะ 7 วัน', 'ยาลดอักเสบ 5 วัน', 'ยาหยอดหู 7 วัน', 'อาหารเฉพาะโรค'],
  plan: ['นัดดูอาการ 3 วัน', 'นัดดูอาการ 7 วัน', 'ถ้าอาการไม่ดีขึ้นให้กลับมาทันที', 'งดอาหาร 12 ชม.', 'ใส่ปลอกคอกันเลีย']
}

/** The exam screen, laid out like the old program's ห้องตรวจ (history on the left, diagnosis and treatment on the right). */
export function VisitForm(props: { petId: string; pet?: any; initial?: any; onClose: () => void; onSaved: (id: string, bill: boolean) => void }) {
  const { me } = useSession()
  const [vets] = useApi<any[]>('users.vets')
  const [f, setF] = useState<any>({
    visit_date: todayStr(),
    vet_id: me.is_vet ? me.id : '',
    ...(props.initial ?? {}),
    pet_id: props.petId
  })
  const [nextAppt, setNextAppt] = useState<{ date: string; topic: string } | null>(null)
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (bill: boolean): Promise<void> => {
    const id = await act(async () => {
      const vid = await api<string>('visits.save', f)
      if (nextAppt) await api('appointments.save', { pet_id: props.petId, appt_date: nextAppt.date, topic: nextAppt.topic, vet_id: f.vet_id, visit_id: vid })
      return vid
    }, nextAppt ? `บันทึกการตรวจและนัด ${longDate(nextAppt.date)} แล้ว` : 'บันทึกการตรวจแล้ว')
    if (id) props.onSaved(id, bill)
  }
  const area = ([k, en, th]: [string, string, string]) => (
    <label key={k} className="exam-field">
      <span><b>{en}</b> {th}</span>
      <textarea value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
      {PHRASES[k] && (
        <span className="phrases">
          {PHRASES[k].map((p) => (
            <button key={p} type="button" onClick={(e) => { e.preventDefault(); set(k, f[k] ? `${f[k]}, ${p}` : p) }}>+ {p}</button>
          ))}
        </span>
      )}
    </label>
  )
  return (
    <Modal
      wide
      title={f.id ? 'แก้ไขบันทึกการตรวจ' : `ห้องตรวจ${props.pet ? ` — ${props.pet.name}` : ''}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button className="secondary" onClick={() => save(false)}>{f.queue_id ? 'บันทึก → ส่งไปรอชำระเงิน' : 'บันทึก'}</button>
          {!f.invoice_id && <button onClick={() => save(true)}>บันทึกและคิดเงินเลย →</button>}
        </>
      }
    >
      {props.pet?.allergy_note && <div className="alert">⚠️ Drug allergy: <b>{props.pet.allergy_note}</b></div>}
      <div className="grid g4">
        <Field label="วันที่ตรวจ">
          <input type="date" value={f.visit_date} onChange={(e) => set('visit_date', e.target.value)} />
        </Field>
        <Field label="สัตวแพทย์">
          <select key={vets?.length ?? 0} value={f.vet_id ?? ''} onChange={(e) => set('vet_id', e.target.value)}>
            <option value="">— เลือก —</option>
            {vets?.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
        <Field label="น้ำหนัก (กก.)">
          <input type="number" step="0.01" value={f.weight_kg ?? ''} onChange={(e) => set('weight_kg', e.target.value)} />
        </Field>
        <Field label="อุณหภูมิ (°C)">
          <input type="number" step="0.1" value={f.temp_c ?? ''} onChange={(e) => set('temp_c', e.target.value)} />
        </Field>
        <Field label="ชีพจร (/นาที)">
          <input type="number" value={f.heart_rate ?? ''} onChange={(e) => set('heart_rate', e.target.value)} />
        </Field>
        <Field label="การหายใจ (/นาที)">
          <input type="number" value={f.resp_rate ?? ''} onChange={(e) => set('resp_rate', e.target.value)} />
        </Field>
      </div>
      <div className="grid g2">
        <div className="stack">{EXAM_LEFT.map(area)}</div>
        <div className="stack">{EXAM_RIGHT.map(area)}</div>
      </div>
      <div className="pick">
        <div className="row">
          <CalendarPlus size={20} color="var(--blue)" /> <b>นัดครั้งถัดไป</b>
          {[
            ['3 วัน', addDays(todayStr(), 3)],
            ['7 วัน', addDays(todayStr(), 7)],
            ['14 วัน', addDays(todayStr(), 14)],
            ['1 เดือน', addMonths(todayStr(), 1)],
            ['1 ปี', addMonths(todayStr(), 12)]
          ].map(([l, d]) => (
            <button key={l} className={`chip ${nextAppt?.date === d ? 'active' : ''}`} onClick={() => setNextAppt({ date: d, topic: nextAppt?.topic ?? 'ตรวจติดตามอาการ' })}>{l}</button>
          ))}
          <input type="date" style={{ width: 170 }} value={nextAppt?.date ?? ''} onChange={(e) => setNextAppt(e.target.value ? { date: e.target.value, topic: nextAppt?.topic ?? 'ตรวจติดตามอาการ' } : null)} />
          {nextAppt && (
            <>
              <select style={{ width: 200 }} value={nextAppt.topic} onChange={(e) => setNextAppt({ ...nextAppt, topic: e.target.value })}>
                {APPT_TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button className="ghost" onClick={() => setNextAppt(null)}>ไม่นัด</button>
            </>
          )}
        </div>
        {nextAppt && <div className="small muted" style={{ marginTop: 6 }}>จะสร้างนัด "{nextAppt.topic}" {longDate(nextAppt.date)}</div>}
      </div>
    </Modal>
  )
}

export function AppointmentForm(props: { pet?: any; initial?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const [vets] = useApi<any[]>('users.vets')
  const [f, setF] = useState<any>({ appt_date: addDays(todayStr(), 7), topic: 'ตรวจติดตามอาการ', pet_id: props.pet?.id, ...(props.initial ?? {}) })
  const [q, setQ] = useState('')
  const [found, setFound] = useState<any[]>([])
  const [pet, setPet] = useState<any>(props.pet ?? (props.initial?.pet_id ? { id: props.initial.pet_id, name: props.initial.pet_name, owner_name: props.initial.owner_name } : null))
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const search = async (text: string): Promise<void> => {
    setQ(text)
    if (!text.trim()) return setFound([])
    const list = await api<any[]>('customers.search', { q: text, limit: 6 })
    const full = await Promise.all(list.map((c) => api('customers.get', { id: c.id })))
    setFound(full.flatMap((c: any) => c.pets.map((p: any) => ({ ...p, owner_name: c.name, phone: c.phone }))))
  }
  const save = async (): Promise<void> => {
    const id = await act(() => api<string>('appointments.save', { ...f, pet_id: pet?.id }), 'บันทึกนัดหมายแล้ว')
    if (id) props.onSaved(id)
  }
  const base = todayStr()
  return (
    <Modal
      wide
      title={f.id ? 'แก้ไขนัดหมาย' : 'นัดลูกค้า'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save} disabled={!pet}>บันทึกนัด</button>
        </>
      }
    >
      {pet ? (
        <div className="pick row">
          <div className="grow"><b>{pet.name}</b> <span className="muted">{pet.code && `(${pet.code})`} · เจ้าของ {pet.owner_name}</span></div>
          {!props.pet && !f.id && <button className="ghost" onClick={() => setPet(null)}>เปลี่ยน</button>}
        </div>
      ) : (
        <Field label="ค้นหาสัตว์เลี้ยง (ชื่อ / เจ้าของ / เบอร์ / รหัส)" required>
          <input autoFocus value={q} onChange={(e) => search(e.target.value)} />
          {found.length > 0 && (
            <div className="results" style={{ position: 'static', marginTop: 6 }}>
              {found.map((p) => (
                <div key={p.id} className="result" style={{ cursor: 'pointer' }} onClick={() => { setPet(p); setFound([]) }}>
                  <b>{p.name}</b> <span className="muted">{p.code} · {p.species} · {p.owner_name} {p.phone}</span>
                </div>
              ))}
            </div>
          )}
        </Field>
      )}
      <Field label="นัดล่วงหน้า">
        <div className="chips">
          {[
            ['3 วัน', addDays(base, 3)],
            ['7 วัน', addDays(base, 7)],
            ['14 วัน', addDays(base, 14)],
            ['1 เดือน', addMonths(base, 1)],
            ['3 เดือน', addMonths(base, 3)],
            ['6 เดือน', addMonths(base, 6)],
            ['1 ปี', addMonths(base, 12)]
          ].map(([l, d]) => (
            <button key={l} className={`chip ${f.appt_date === d ? 'active' : ''}`} onClick={() => set('appt_date', d)}>{l}</button>
          ))}
        </div>
      </Field>
      <div className="grid g3">
        <Field label="วันนัด" required>
          <input type="date" value={f.appt_date} onChange={(e) => set('appt_date', e.target.value)} />
        </Field>
        <Field label="เวลานัด">
          <input type="time" value={f.appt_time ?? ''} onChange={(e) => set('appt_time', e.target.value)} />
        </Field>
        <Field label="สัตวแพทย์">
          <select key={vets?.length ?? 0} value={f.vet_id ?? ''} onChange={(e) => set('vet_id', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {vets?.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
      </div>
      <div className="small muted">{longDate(f.appt_date)}</div>
      <Field label="หัวข้อนัดหมาย" required>
        <div className="chips">
          {APPT_TOPICS.map((t) => (
            <button key={t} className={`chip ${f.topic === t ? 'active' : ''}`} onClick={() => set('topic', t)}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="รายละเอียดเพิ่มเติม (จะพิมพ์ในใบนัด)">
        <input value={f.detail ?? ''} onChange={(e) => set('detail', e.target.value)} placeholder="งดอาหารก่อนมา 8 ชั่วโมง" />
      </Field>
    </Modal>
  )
}

export function VaccinationForm(props: { petId: string; onClose: () => void; onSaved: () => void }) {
  const { me } = useSession()
  const [types] = useApi<any[]>('vaccineTypes.list')
  const [vets] = useApi<any[]>('users.vets')
  const [f, setF] = useState<any>({ given_date: todayStr(), vet_id: me.is_vet ? me.id : '', pet_id: props.petId })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (): Promise<void> => {
    if (await act(() => api('vaccinations.add', f), 'บันทึกวัคซีนแล้ว')) props.onSaved()
  }
  return (
    <Modal
      title="บันทึกวัคซีน/ยาป้องกัน (ไม่ผ่านบิล)"
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!f.vaccine_type_id && !f.name} onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="alert info small">
        ถ้าขายวัคซีนผ่านหน้าขาย ระบบจะบันทึกให้อัตโนมัติ — ใช้หน้านี้สำหรับบันทึกย้อนหลัง หรือวัคซีนที่ฉีดจากที่อื่น
      </div>
      <Field label="ชนิดวัคซีน/ยาป้องกัน" required>
        <select value={f.vaccine_type_id ?? ''} onChange={(e) => set('vaccine_type_id', e.target.value)}>
          <option value="">— อื่น ๆ (พิมพ์ชื่อเอง) —</option>
          {types?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} (ทุก {t.interval_days} วัน)
            </option>
          ))}
        </select>
      </Field>
      {!f.vaccine_type_id && (
        <Field label="ชื่อวัคซีน" required>
          <input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
      )}
      <div className="grid g2">
        <Field label="วันที่ให้" required>
          <input type="date" value={f.given_date} onChange={(e) => set('given_date', e.target.value)} />
        </Field>
        <Field label="นัดครั้งถัดไป (เว้นว่าง = คำนวณอัตโนมัติ)">
          <input type="date" value={f.next_due_date ?? ''} onChange={(e) => set('next_due_date', e.target.value)} />
        </Field>
        <Field label="Lot No.">
          <input value={f.lot_no ?? ''} onChange={(e) => set('lot_no', e.target.value)} />
        </Field>
        <Field label="สัตวแพทย์">
          <select key={vets?.length ?? 0} value={f.vet_id ?? ''} onChange={(e) => set('vet_id', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {vets?.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="หมายเหตุ">
        <input value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </Modal>
  )
}
