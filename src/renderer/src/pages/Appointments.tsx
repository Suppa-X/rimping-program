import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Phone, PhoneCall, Copy, ListPlus, Printer, Pencil, X, UserX, CalendarCheck, Clock, MessageCircle } from 'lucide-react'
import { api, thDate, todayStr, addDays, longDate, openPrint } from '../api'
import { useApi, useAction, useToast, Empty, SpeciesIcon, Hint } from '../ui'
import { AppointmentForm } from './forms'
import Vaccines from './Vaccines'

const TABS = [
  { key: 'today', label: 'นัดวันนี้' },
  { key: 'upcoming', label: 'นัดที่จะถึง (7 วัน)' },
  { key: 'missed', label: 'เลยนัด / ไม่มา' },
  { key: 'vaccines', label: 'วัคซีนครบกำหนด' }
]

export default function Appointments() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'today'
  const [creating, setCreating] = useState(false)
  const t = todayStr()
  const range =
    tab === 'today' ? { from: t, to: t, status: 'pending' } : tab === 'upcoming' ? { from: addDays(t, 1), to: addDays(t, 7), status: 'pending' } : { from: addDays(t, -60), to: addDays(t, -1), status: 'pending' }
  const [rows, reload] = useApi<any[]>('appointments.list', range, [tab])
  const [d] = useApi<any>('reports.dashboard', undefined, [tab])

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>นัดหมาย</h1>
          <div className="lead">นัดตรวจ นัดวัคซีน นัดผ่าตัด — โทรหรือส่ง LINE แจ้งเจ้าของล่วงหน้า แล้วกด "โทรแล้ว"</div>
        </div>
        <button className="big" onClick={() => setCreating(true)}><CalendarPlus /> นัดลูกค้า</button>
      </div>
      <div className="subtabs">
        {TABS.map((x) => (
          <button key={x.key} className={tab === x.key ? 'active' : ''} onClick={() => setParams({ tab: x.key })}>
            {x.label}
            {x.key === 'today' && d?.appt_today ? <span className="count">{d.appt_today}</span> : null}
            {x.key === 'vaccines' && d?.vaccines_due ? <span className="count">{d.vaccines_due}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'vaccines' ? (
        <Vaccines embedded />
      ) : !rows?.length ? (
        <div className="card"><Empty icon={<CalendarCheck />} text={tab === 'missed' ? 'ไม่มีนัดที่เลยกำหนด' : 'ไม่มีนัดในช่วงนี้'} /></div>
      ) : (
        <div className="grid g2">
          {rows.map((r) => <ApptCard key={r.id} r={r} missed={tab === 'missed'} onChange={reload} />)}
        </div>
      )}
      {tab !== 'vaccines' && (
        <div style={{ marginTop: 16 }}>
          <Hint>โปรแกรมเดิมมีข้อความเตือน "อย่าลืมโทรตามนัด" — ที่นี่ใช้ปุ่ม <b>โทรแล้ว</b> เพื่อบันทึกว่าแจ้งลูกค้าแล้ว นัดที่ยังไม่ได้โทรจะนับเป็นตัวเลขสีส้มบนแท็บ</Hint>
        </div>
      )}
      {creating && <AppointmentForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload() }} />}
    </>
  )
}

function ApptCard({ r, missed, onChange }: { r: any; missed: boolean; onChange: () => void }) {
  const nav = useNavigate()
  const act = useAction()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const status = async (s: string, text: string): Promise<void> => {
    if (await act(() => api('appointments.setStatus', { id: r.id, status: s }), text)) onChange()
  }
  const message =
    `สวัสดีค่ะ คุณ${r.owner_name.replace(/^คุณ/, '')} ริมปิงสัตวแพทย์ขอแจ้งนัด ${r.pet_name} ` +
    `เรื่อง${r.topic} ${longDate(r.appt_date)}${r.appt_time ? ` เวลา ${r.appt_time} น.` : ''}${r.detail ? ` (${r.detail})` : ''} 🐾`
  const arrived = async (): Promise<void> => {
    const ok = await act(async () => {
      await api('queue.add', { pet_id: r.pet_id, reason: r.topic })
      await api('appointments.setStatus', { id: r.id, status: 'done' })
      return true
    }, `${r.pet_name} เข้าคิวแล้ว`)
    if (ok) nav('/')
  }
  return (
    <div className="card" style={{ borderLeft: `5px solid ${missed ? 'var(--bad)' : r.called_at ? 'var(--ok)' : 'var(--orange)'}`, borderRadius: 0 }}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <SpeciesIcon species={r.species} />
        <div className="grow">
          <div className="row" style={{ gap: 8 }}>
            <h2><a onClick={() => nav(`/pets/${r.pet_id}`)}>{r.pet_name}</a></h2>
            <span className="muted small">{r.pet_code}</span>
            {r.called_at ? <span className="badge ok"><PhoneCall size={12} /> โทรแล้ว</span> : <span className="badge warn">ยังไม่ได้โทร</span>}
          </div>
          <div><b>{r.topic}</b> · {thDate(r.appt_date)} {r.appt_time && <><Clock size={13} style={{ verticalAlign: -2 }} /> {r.appt_time}</>} {r.vet_name && `· ${r.vet_name}`}</div>
          {r.detail && <div className="small muted">{r.detail}</div>}
          <div className="muted small" style={{ marginTop: 4 }}>
            {r.owner_name} · <Phone size={13} style={{ verticalAlign: -2 }} /> {r.phone ?? '-'}
            {r.line_id && <> · <MessageCircle size={13} style={{ verticalAlign: -2 }} /> {r.line_id}</>}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {!r.called_at && <button className="secondary" onClick={async () => (await act(() => api('appointments.markCalled', { id: r.id }), 'บันทึกว่าโทรแจ้งแล้ว')) && onChange()}><PhoneCall /> โทรแล้ว</button>}
        <button className="secondary" onClick={async () => { await navigator.clipboard.writeText(message); toast('คัดลอกข้อความแล้ว — วางใน LINE ได้เลย') }}><Copy /> ข้อความ LINE</button>
        <button onClick={arrived}><ListPlus /> มาแล้ว → เข้าคิว</button>
        <button className="ghost" onClick={() => openPrint(`/print/appointment/${r.id}?lang=th`)}><Printer /> ใบนัด</button>
        <button className="ghost" onClick={() => openPrint(`/print/appointment/${r.id}?lang=en`)}>EN</button>
        <button className="ghost" onClick={() => setEditing(true)}><Pencil /> แก้ไข</button>
        {missed ? (
          <button className="ghost" style={{ color: 'var(--muted)' }} onClick={() => status('no_show', 'บันทึกว่าลูกค้าไม่มา')}><UserX /> ไม่มา</button>
        ) : (
          <button className="ghost" style={{ color: 'var(--muted)' }} onClick={() => status('cancelled', 'ยกเลิกนัดแล้ว')}><X /> ยกเลิกนัด</button>
        )}
      </div>
      {editing && <AppointmentForm initial={r} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChange() }} />}
    </div>
  )
}
