import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BedDouble, Plus, AlertTriangle, CircleCheck, CircleAlert } from 'lucide-react'
import { api, money, thDate, todayStr, METHOD_LABEL } from '../api'
import { useApi, useAction, useSession, Modal, Field, Empty, SpeciesIcon, Hint } from '../ui'

export default function Admissions() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'admitted' | 'discharged'>('admitted')
  const [rows, reload] = useApi<any[]>('admissions.list', { status: tab }, [tab])
  const [admitting, setAdmitting] = useState(false)
  const live = tab === 'admitted'
  const total = (rows ?? []).reduce((t, r) => t + r.total, 0)

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>Admit / ฝากเลี้ยง</h1>
          <div className="lead">สัตว์ที่นอนโรงพยาบาลหรือฝากเลี้ยง — ลงค่าใช้จ่ายทุกวัน แล้วคิดเงินรวมตอนรับกลับ</div>
        </div>
        <button className="big" onClick={() => setAdmitting(true)}><Plus /> รับ Admit / ฝากเลี้ยง</button>
      </div>
      <div className="subtabs">
        <button className={live ? 'active' : ''} onClick={() => setTab('admitted')}>กำลัง Admit {live && rows ? <span className="count">{rows.length}</span> : null}</button>
        <button className={!live ? 'active' : ''} onClick={() => setTab('discharged')}>รับกลับแล้ว</button>
      </div>
      {live && rows && rows.length > 0 && (
        <div className="alert info" style={{ marginBottom: 14 }}>
          กำลัง Admit {rows.length} ตัว · ค่าใช้จ่ายสะสมรวม {money(total)} บาท · ยังไม่ได้ลงค่าใช้จ่ายวันนี้ {rows.filter((r) => !r.charged_today).length} ตัว
        </div>
      )}
      {!rows?.length ? (
        <div className="card"><Empty icon={<BedDouble />} text={live ? 'ตอนนี้ไม่มีสัตว์ Admit' : 'ยังไม่มีประวัติ'} /></div>
      ) : (
        <div className="grid g3">
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ cursor: 'pointer', borderTop: `4px solid ${r.kind === 'boarding' ? 'var(--orange)' : 'var(--purple)'}` }} onClick={() => nav(`/admissions/${r.id}`)}>
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <SpeciesIcon species={r.species} />
                <div className="grow">
                  <h2>{r.pet_name} <span className="muted small">{r.pet_code}</span></h2>
                  <div className="muted small">{r.owner_name} · {r.phone}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span className={`badge ${r.kind === 'boarding' ? 'warn' : 'purple'}`}>{r.kind === 'boarding' ? 'ฝากเลี้ยง' : 'Admit รักษา'}</span>
                    {r.cage && <span className="badge grey">กรง {r.cage}</span>}
                    <span className="badge">วันที่ {r.days}</span>
                  </div>
                </div>
              </div>
              {r.reason && <div className="small" style={{ marginTop: 8 }}>{r.reason}</div>}
              {(r.allergy_note || r.warning_note) && (
                <div className="tiny" style={{ color: 'var(--bad)', marginTop: 4 }}><AlertTriangle size={12} /> {r.allergy_note ? `แพ้ ${r.allergy_note}` : r.warning_note}</div>
              )}
              <div className="totals" style={{ marginTop: 10 }}>
                <div><span className="muted">ค่าใช้จ่ายสะสม</span><b className="num">{money(r.total)}</b></div>
                {r.deposit_balance > 0 && <div><span className="muted">มัดจำ</span><span className="num" style={{ color: 'var(--ok)' }}>{money(r.deposit_balance)}</span></div>}
              </div>
              <div className="tiny" style={{ marginTop: 6 }}>
                {live ? (
                  r.charged_today ? (
                    <span style={{ color: 'var(--ok)' }}><CircleCheck size={13} style={{ verticalAlign: -2 }} /> ลงค่าใช้จ่ายวันนี้แล้ว</span>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}><CircleAlert size={13} style={{ verticalAlign: -2 }} /> ยังไม่ได้ลงค่าใช้จ่ายวันนี้</span>
                  )
                ) : (
                  <span className="muted">รับเข้า {thDate(r.admitted_at)} · รับกลับ {thDate(r.discharged_at)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <Hint>ขั้นตอน: รับ Admit (รับมัดจำได้) → ลงค่าใช้จ่ายทุกวัน (ค่าห้อง ยา น้ำเกลือ หัตถการ) → วันรับกลับกด "คิดเงิน" ระบบรวมทุกวัน หักมัดจำ แล้วพิมพ์ใบเสร็จ</Hint>
      </div>
      {admitting && <AdmitModal onClose={() => setAdmitting(false)} onDone={(id) => nav(`/admissions/${id}`)} />}
    </>
  )
}

export function AdmitModal(props: { pet?: any; onClose: () => void; onDone: (id: string) => void }) {
  const { me, shift } = useSession()
  const [vets] = useApi<any[]>('users.vets')
  const [pet, setPet] = useState<any>(props.pet ?? null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<any[]>([])
  const [f, setF] = useState<any>({ kind: 'ipd', vet_id: me.is_vet ? me.id : '', deposit: '', method: 'cash' })
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
    const id = await act(async () => {
      const aid = await api<string>('admissions.admit', { ...f, pet_id: pet.id })
      if (Number(f.deposit) > 0) await api('deposits.add', { customer_id: pet.customer_id, amount: f.deposit, method: f.method, note: `มัดจำ Admit ${pet.name}` })
      return aid
    }, `รับ ${pet?.name} เข้า Admit แล้ว`)
    if (id) props.onDone(id)
  }
  return (
    <Modal
      wide
      title="รับ Admit / ฝากเลี้ยง"
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!pet || (Number(f.deposit) > 0 && !shift)} onClick={save}>รับเข้า</button>
        </>
      }
    >
      {pet ? (
        <div className="pick row">
          <SpeciesIcon species={pet.species} size={16} />
          <div className="grow"><b>{pet.name}</b> <span className="muted">{pet.code} · เจ้าของ {pet.owner_name}</span></div>
          {!props.pet && <button className="ghost" onClick={() => setPet(null)}>เปลี่ยน</button>}
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
      <Field label="ประเภท">
        <div className="chips">
          <button className={`chip ${f.kind === 'ipd' ? 'active' : ''}`} onClick={() => set('kind', 'ipd')}>Admit รักษา (สัตว์ป่วย)</button>
          <button className={`chip ${f.kind === 'boarding' ? 'active' : ''}`} onClick={() => set('kind', 'boarding')}>ฝากเลี้ยง</button>
        </div>
      </Field>
      <div className="grid g3">
        <Field label="กรง / ห้อง">
          <input value={f.cage ?? ''} onChange={(e) => set('cage', e.target.value)} placeholder="A3" />
        </Field>
        <Field label="สัตวแพทย์เจ้าของไข้">
          <select key={vets?.length ?? 0} value={f.vet_id} onChange={(e) => set('vet_id', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {vets?.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
        <Field label="คาดว่าจะรับกลับ">
          <input type="date" min={todayStr()} value={f.expected_out ?? ''} onChange={(e) => set('expected_out', e.target.value)} />
        </Field>
      </div>
      <Field label="สาเหตุ / อาการ">
        <input value={f.reason ?? ''} onChange={(e) => set('reason', e.target.value)} placeholder="ท้องเสีย ให้น้ำเกลือ" />
      </Field>
      <div className="grid g2">
        <Field label="รับมัดจำ (บาท) — ถ้ามี">
          <input type="number" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} />
        </Field>
        <Field label="ช่องทาง">
          <div className="chips">
            {['cash', 'transfer', 'promptpay', 'card'].map((m) => (
              <button key={m} className={`chip ${f.method === m ? 'active' : ''}`} onClick={() => set('method', m)}>{METHOD_LABEL[m]}</button>
            ))}
          </div>
        </Field>
      </div>
      {Number(f.deposit) > 0 && !shift && <div className="alert">ต้องเปิดกะก่อนรับเงินมัดจำ</div>}
    </Modal>
  )
}
