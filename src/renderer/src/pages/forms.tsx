import { useState } from 'react'
import { api, SPECIES, todayStr } from '../api'
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
      title={f.id ? 'แก้ไขข้อมูลลูกค้า' : 'ลูกค้าใหม่'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <Field label="ชื่อ-นามสกุล" required>
        <input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid g2">
        <Field label="เบอร์โทร">
          <input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="เบอร์โทรสำรอง">
          <input value={f.phone2 ?? ''} onChange={(e) => set('phone2', e.target.value)} />
        </Field>
        <Field label="LINE ID">
          <input value={f.line_id ?? ''} onChange={(e) => set('line_id', e.target.value)} />
        </Field>
        <Field label="เลขผู้เสียภาษี (ถ้าต้องการใบกำกับเต็มรูป)">
          <input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} />
        </Field>
      </div>
      <Field label="ที่อยู่">
        <textarea value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <Field label="หมายเหตุ">
        <input value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      </Field>
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
      title={f.id ? 'แก้ไขข้อมูลสัตว์เลี้ยง' : 'เพิ่มสัตว์เลี้ยง'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="grid g2">
        <Field label="ชื่อสัตว์" required>
          <input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="ชนิด" required>
          <input list="species" value={f.species ?? ''} onChange={(e) => set('species', e.target.value)} />
          <datalist id="species">
            {SPECIES.map((s) => <option key={s} value={s} />)}
          </datalist>
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
      <Field label="⚠️ แพ้ยา/อาหาร">
        <input value={f.allergy_note ?? ''} onChange={(e) => set('allergy_note', e.target.value)} />
      </Field>
      <Field label="⚠️ ข้อควรระวัง (เช่น ดุ กัด)">
        <input value={f.warning_note ?? ''} onChange={(e) => set('warning_note', e.target.value)} />
      </Field>
      <Field label="หมายเหตุ">
        <textarea value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </Modal>
  )
}

export function VisitForm(props: { petId: string; initial?: any; onClose: () => void; onSaved: (id: string, bill: boolean) => void }) {
  const { me } = useSession()
  const [vets] = useApi<any[]>('users.vets')
  const [f, setF] = useState<any>({
    visit_date: todayStr(),
    vet_id: me.is_vet ? me.id : '',
    ...(props.initial ?? {}),
    pet_id: props.petId
  })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (bill: boolean): Promise<void> => {
    const id = await act(() => api<string>('visits.save', f), 'บันทึกการตรวจแล้ว')
    if (id) props.onSaved(id, bill)
  }
  return (
    <Modal
      wide
      title={f.id ? 'แก้ไขบันทึกการตรวจ' : 'บันทึกการตรวจ (SOAP)'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button className="secondary" onClick={() => save(false)}>{f.queue_id ? "บันทึก → ส่งไปรอชำระเงิน" : "บันทึก"}</button>
          {!f.invoice_id && <button onClick={() => save(true)}>บันทึกและคิดเงินเลย →</button>}
        </>
      }
    >
      <div className="grid g3">
        <Field label="วันที่ตรวจ" required>
          <input type="date" value={f.visit_date} onChange={(e) => set('visit_date', e.target.value)} />
        </Field>
        <Field label="สัตวแพทย์">
          <select value={f.vet_id ?? ''} onChange={(e) => set('vet_id', e.target.value)}>
            <option value="">— เลือก —</option>
            {vets?.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
        <div />
      </div>
      <div className="grid g4">
        <Field label="น้ำหนัก (กก.)">
          <input type="number" step="0.01" value={f.weight_kg ?? ''} onChange={(e) => set('weight_kg', e.target.value)} />
        </Field>
        <Field label="อุณหภูมิ (°C)">
          <input type="number" step="0.1" value={f.temp_c ?? ''} onChange={(e) => set('temp_c', e.target.value)} />
        </Field>
        <Field label="ชีพจร (ครั้ง/นาที)">
          <input type="number" value={f.heart_rate ?? ''} onChange={(e) => set('heart_rate', e.target.value)} />
        </Field>
        <Field label="การหายใจ (ครั้ง/นาที)">
          <input type="number" value={f.resp_rate ?? ''} onChange={(e) => set('resp_rate', e.target.value)} />
        </Field>
      </div>
      <Field label="S — อาการที่เจ้าของแจ้ง (Subjective)">
        <textarea value={f.subjective ?? ''} onChange={(e) => set('subjective', e.target.value)} />
      </Field>
      <Field label="O — ผลการตรวจร่างกาย (Objective)">
        <textarea value={f.objective ?? ''} onChange={(e) => set('objective', e.target.value)} />
      </Field>
      <Field label="A — การวินิจฉัย (Assessment)">
        <textarea value={f.assessment ?? ''} onChange={(e) => set('assessment', e.target.value)} />
      </Field>
      <Field label="P — แผนการรักษา/ยาที่ให้ (Plan)">
        <textarea value={f.plan ?? ''} onChange={(e) => set('plan', e.target.value)} />
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
          <select value={f.vet_id ?? ''} onChange={(e) => set('vet_id', e.target.value)}>
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
