import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Stethoscope, ShoppingBag, AlertTriangle, Syringe, Receipt, ClipboardList, Plus, Weight, Thermometer, HeartPulse, Wind, ListPlus, Cpu } from 'lucide-react'
import { api, money, thDate, age, SEX_LABEL, todayStr } from '../api'
import { useApi, useAction, useSession, StatusBadge, Empty, SpeciesIcon } from '../ui'
import { PetForm, VisitForm, VaccinationForm } from './forms'

export default function PetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { can } = useSession()
  const act = useAction()
  const queueId = params.get('queue') ?? undefined
  const [p, reload] = useApi<any>('pets.get', { id }, [id])
  const [tab, setTab] = useState<'visits' | 'vaccines' | 'bills'>('visits')
  const [editing, setEditing] = useState(false)
  const [visit, setVisit] = useState<any | null>(params.get('exam') === '1' ? {} : null)
  const [addingVacc, setAddingVacc] = useState(false)
  if (!p) return null

  const goBill = (visitId?: string, vetId?: string): void =>
    void nav(`/pos?customer=${p.customer_id}&pet=${p.id}${visitId ? `&visit=${visitId}` : ''}${vetId ? `&vet=${vetId}` : ''}${queueId ? `&queue=${queueId}` : ''}`)
  const enqueue = async (): Promise<void> => {
    if (await act(() => api('queue.add', { pet_id: p.id, reason: 'ตรวจรักษา' }), `${p.name} เข้าคิวแล้ว`)) nav('/')
  }
  const due = p.vaccinations.filter((x: any) => !x.done_followup && x.next_due_date)

  return (
    <>
      <a className="back" onClick={() => nav(`/customers/${p.customer_id}`)}><ArrowLeft size={16} /> {p.owner_name}</a>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="profile">
          <SpeciesIcon species={p.species} size={34} />
          <div className="info">
            <div className="row" style={{ gap: 10 }}>
              <h1>{p.name}</h1>
              {p.deceased ? <span className="badge grey">เสียชีวิต</span> : null}
              {queueId && <span className="badge purple">กำลังตรวจจากคิว</span>}
            </div>
            <div className="chips-line">
              <span>{p.species}{p.breed && ` · ${p.breed}`}</span>
              <span>{SEX_LABEL[p.sex]}{p.neutered ? ' (ทำหมันแล้ว)' : ''}</span>
              <span>อายุ {age(p.birth_date)}</span>
              {p.weight_kg ? <span><Weight size={16} /> {p.weight_kg} กก.</span> : null}
              {p.microchip && <span><Cpu size={16} /> {p.microchip}</span>}
              <span>เจ้าของ: <a onClick={() => nav(`/customers/${p.customer_id}`)}>{p.owner_name}</a> {p.owner_phone}</span>
            </div>
          </div>
          <div className="stack" style={{ alignItems: 'stretch' }}>
            {can('emr.edit') && <button className="big" onClick={() => setVisit({})}><Stethoscope /> บันทึกการตรวจ</button>}
            <div className="row">
              {!queueId && <button className="secondary" onClick={enqueue}><ListPlus /> เข้าคิว</button>}
              <button className="secondary" onClick={() => goBill()}><ShoppingBag /> คิดเงิน</button>
              <button className="secondary" onClick={() => setEditing(true)}><Pencil /> แก้ไข</button>
            </div>
          </div>
        </div>
        {(p.allergy_note || p.warning_note) && (
          <div className="alert" style={{ marginTop: 14 }}>
            <AlertTriangle size={18} /> {p.allergy_note && <b>แพ้: {p.allergy_note}</b>} {p.warning_note && ` · ${p.warning_note}`}
          </div>
        )}
      </div>

      <div className="subtabs">
        <button className={tab === 'visits' ? 'active' : ''} onClick={() => setTab('visits')}><ClipboardList size={17} /> ประวัติการรักษา ({p.visits.length})</button>
        <button className={tab === 'vaccines' ? 'active' : ''} onClick={() => setTab('vaccines')}>
          <Syringe size={17} /> วัคซีน/ยาป้องกัน ({p.vaccinations.length}) {due.some((x: any) => x.next_due_date <= todayStr()) && <span className="count">!</span>}
        </button>
        <button className={tab === 'bills' ? 'active' : ''} onClick={() => setTab('bills')}><Receipt size={17} /> บิล ({p.invoices.length})</button>
      </div>

      {tab === 'visits' && (
        <div className="card">
          {p.visits.length === 0 ? (
            <Empty icon={<ClipboardList />} text="ยังไม่มีประวัติการรักษา — กด &quot;บันทึกการตรวจ&quot; เพื่อเริ่ม" />
          ) : (
            <div className="timeline">
              {p.visits.map((v: any) => (
                <div key={v.id} className="tl-item">
                  <div className="row">
                    <h3>{thDate(v.visit_date)}</h3>
                    <span className="muted">โดย {v.vet_name ?? 'ไม่ระบุแพทย์'}</span>
                    <div className="grow" />
                    {v.invoice_id ? (
                      <button className="ghost" onClick={() => nav(`/invoices/${v.invoice_id}`)}><Receipt /> บิล {v.invoice_no}</button>
                    ) : (
                      <button className="ghost" onClick={() => goBill(v.id, v.vet_id)}><ShoppingBag /> คิดเงิน</button>
                    )}
                    {can('emr.edit') && <button className="ghost" onClick={() => setVisit(v)}><Pencil /> แก้ไข</button>}
                  </div>
                  <div className="vitals" style={{ marginTop: 6 }}>
                    {v.weight_kg && <span className="badge"><Weight size={13} /> {v.weight_kg} กก.</span>}
                    {v.temp_c && <span className={`badge ${v.temp_c >= 39.5 ? 'bad' : ''}`}><Thermometer size={13} /> {v.temp_c}°C</span>}
                    {v.heart_rate && <span className="badge"><HeartPulse size={13} /> {v.heart_rate}/นาที</span>}
                    {v.resp_rate && <span className="badge"><Wind size={13} /> {v.resp_rate}/นาที</span>}
                  </div>
                  <div className="soap">
                    {v.subjective && <><b>S</b><div><span className="muted">อาการ:</span> {v.subjective}</div></>}
                    {v.objective && <><b>O</b><div><span className="muted">ตรวจพบ:</span> {v.objective}</div></>}
                    {v.assessment && <><b>A</b><div><span className="muted">วินิจฉัย:</span> <b style={{ background: 'none', color: 'var(--navy)', fontSize: 15 }}>{v.assessment}</b></div></>}
                    {v.plan && <><b>P</b><div><span className="muted">การรักษา:</span> {v.plan}</div></>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'vaccines' && (
        <div className="card">
          <div className="card-head">
            <h2 className="grow"><Syringe /> สมุดวัคซีน</h2>
            <button className="secondary" onClick={() => setAddingVacc(true)}><Plus /> บันทึกวัคซีนย้อนหลัง</button>
          </div>
          {p.vaccinations.length === 0 ? (
            <Empty icon={<Syringe />} text="ยังไม่มีประวัติวัคซีน — ขายวัคซีนในหน้าคิดเงินแล้วระบบจะบันทึกให้อัตโนมัติ" />
          ) : (
            <table>
              <thead>
                <tr><th>วันที่ให้</th><th>วัคซีน/ยา</th><th>Lot</th><th>แพทย์</th><th>นัดครั้งถัดไป</th><th></th></tr>
              </thead>
              <tbody>
                {p.vaccinations.map((x: any) => {
                  const overdue = !x.done_followup && x.next_due_date && x.next_due_date < todayStr()
                  return (
                    <tr key={x.id}>
                      <td>{thDate(x.given_date)}</td>
                      <td className="bold">{x.name}</td>
                      <td>{x.lot_no ?? '-'}</td>
                      <td>{x.vet_name ?? '-'}</td>
                      <td>
                        {x.next_due_date ? thDate(x.next_due_date) : '-'}{' '}
                        {x.done_followup ? <span className="badge grey">ปิดแล้ว</span> : overdue ? <span className="badge bad">เลยกำหนด</span> : null}
                      </td>
                      <td className="right">
                        {!x.done_followup && x.next_due_date && (
                          <button className="ghost" onClick={async () => (await act(() => api('vaccinations.markDone', { id: x.id }), 'ปิดการแจ้งเตือนแล้ว')) && reload()}>
                            ปิดแจ้งเตือน
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'bills' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {p.invoices.length === 0 ? (
            <Empty icon={<Receipt />} text="ยังไม่มีบิล" />
          ) : (
            <table>
              <thead><tr><th>เลขที่</th><th>วันที่</th><th className="num">ยอด</th><th>สถานะ</th></tr></thead>
              <tbody>
                {p.invoices.map((i: any) => (
                  <tr key={i.id} className={`clickable ${i.status === 'void' ? 'void' : ''}`} onClick={() => nav(`/invoices/${i.id}`)}>
                    <td>{i.invoice_no}</td>
                    <td>{thDate(i.issued_at, true)}</td>
                    <td className="num">{money(i.total)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && <PetForm customerId={p.customer_id} initial={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {visit && (
        <VisitForm
          petId={p.id}
          initial={visit.id ? visit : { weight_kg: p.weight_kg, queue_id: queueId }}
          onClose={() => setVisit(null)}
          onSaved={(vid, bill) => {
            setVisit(null)
            if (bill) goBill(vid, visit.vet_id)
            else if (queueId && !visit.id) nav('/')
            else reload()
          }}
        />
      )}
      {addingVacc && <VaccinationForm petId={p.id} onClose={() => setAddingVacc(false)} onSaved={() => { setAddingVacc(false); reload() }} />}
    </>
  )
}
