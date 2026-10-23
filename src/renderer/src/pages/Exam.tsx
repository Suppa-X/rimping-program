import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Stethoscope, CreditCard, CheckCircle2, FileText, Receipt, AlertTriangle, X, CalendarCheck, Footprints } from 'lucide-react'
import { api, money } from '../api'
import { useApi, useAction, useSession, Hint } from '../ui'

export const LANES = [
  { key: 'waiting', label: 'รอตรวจ', color: '#f08a33', icon: Clock },
  { key: 'in_exam', label: 'กำลังตรวจ', color: '#7c4dde', icon: Stethoscope },
  { key: 'to_pay', label: 'รอชำระเงิน', color: '#14a37f', icon: CreditCard },
  { key: 'done', label: 'เสร็จแล้ว', color: '#6b7f93', icon: CheckCircle2 }
]

/** "นัด 14:00" for a checked-in appointment, otherwise Walk-in. */
export function SourceBadge({ q }: { q: any }) {
  return q.appointment_id ? (
    <span className="badge rose"><CalendarCheck size={13} /> นัด {q.appt_time ?? ''}</span>
  ) : (
    <span className="badge sky"><Footprints size={13} /> Walk-in</span>
  )
}

export const payUrl = (q: any): string =>
  `/pos?customer=${q.customer_id}&pet=${q.pet_id}&queue=${q.id}${q.visit_id ? `&visit=${q.visit_id}` : ''}${q.vet_id ? `&vet=${q.vet_id}` : ''}`

/** ตรวจรักษา: today's queue as a board, from waiting to paid. */
export default function Exam() {
  const nav = useNavigate()
  const act = useAction()
  const { me } = useSession()
  const [queue, reload] = useApi<any[]>('queue.today')

  useEffect(() => {
    const t = setInterval(reload, 20000)
    return () => clearInterval(t)
  }, [reload])

  const setStatus = async (q: any, status: string): Promise<void> => {
    await act(() => api('queue.setStatus', { id: q.id, status, vet_id: status === 'in_exam' && me.is_vet ? me.id : undefined }))
    reload()
  }
  const startExam = async (q: any): Promise<void> => {
    if (q.status === 'waiting') await setStatus(q, 'in_exam')
    nav(`/pets/${q.pet_id}?queue=${q.id}&exam=1`)
  }

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem violet"><Stethoscope /></span> ตรวจรักษา</h1>
          <div className="lead">คิววันนี้ทั้งหมด — กด "เริ่มตรวจ" เพื่อบันทึกอาการ เสร็จแล้วกด "ส่งไปชำระเงิน"</div>
        </div>
        <button className="secondary" onClick={() => nav('/')}>+ รับลูกค้าเข้าคิว</button>
      </div>
      <div className="board">
        {LANES.map((lane) => {
          const items = (queue ?? []).filter((q) => q.status === lane.key)
          return (
            <div key={lane.key} className="lane" style={{ ['--lane' as any]: lane.color }}>
              <div className="lane-head">
                <lane.icon size={20} color={lane.color} /> {lane.label}
                <span className="n">{items.length}</span>
              </div>
              {items.length === 0 && <div className="lane-empty">ว่าง</div>}
              {items.map((q) => (
                <div key={q.id} className="qcard" style={{ borderLeftColor: lane.color }}>
                  <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <div className="no">{q.queue_no}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="pet">{q.pet_name} <span className="muted small">({q.species})</span></div>
                      <div className="meta">{q.owner_name} · {q.phone}</div>
                    </div>
                    {lane.key !== 'done' && (
                      <button className="ghost" aria-label="ยกเลิกคิว" title="ยกเลิกคิว" onClick={() => setStatus(q, 'cancelled')}><X size={16} /></button>
                    )}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <SourceBadge q={q} />
                    {q.reason && <span className="badge">{q.reason}</span>}
                  </div>
                  {(q.allergy_note || q.warning_note) && (
                    <div className="tiny" style={{ color: 'var(--bad)', marginTop: 6 }}>
                      <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {[q.allergy_note && `แพ้ ${q.allergy_note}`, q.warning_note].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="meta" style={{ marginTop: 4 }}>
                    เข้าคิว {q.created_at.slice(11, 16)} {q.vet_name && `· ${q.vet_name}`}
                  </div>
                  <div className="acts">
                    {q.status === 'waiting' && <button onClick={() => startExam(q)}><Stethoscope /> เริ่มตรวจ</button>}
                    {q.status === 'waiting' && <button className="secondary" onClick={() => nav(payUrl(q))}>ไม่ตรวจ → คิดเงิน</button>}
                    {q.status === 'in_exam' && <button onClick={() => startExam(q)}><FileText /> บันทึกการตรวจ</button>}
                    {q.status === 'in_exam' && <button className="secondary" onClick={() => setStatus(q, 'to_pay')}>ส่งไปชำระเงิน</button>}
                    {q.status === 'to_pay' && <button className="ok" onClick={() => nav(payUrl(q))}><CreditCard /> รับเงิน</button>}
                    {q.status === 'done' && q.invoice_id && (
                      <button className="ghost" onClick={() => nav(`/invoices/${q.invoice_id}`)}>
                        <Receipt /> {q.invoice_no} · {money(q.invoice_total)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <Hint>ลูกค้าที่มีนัดจะมีป้าย <b>นัด</b> สีชมพู ส่วนลูกค้าที่มาเองโดยไม่ได้นัด (ลูกค้าเก่าหรือลูกค้าใหม่) จะมีป้าย <b>Walk-in</b> สีฟ้า</Hint>
      </div>
    </>
  )
}
