import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Syringe, Phone, MessageCircle, Copy, ShoppingBag, BellOff, ListPlus } from 'lucide-react'
import { api, thDate, todayStr } from '../api'
import { useApi, useAction, useToast, Empty, SpeciesIcon, Hint } from '../ui'

const RANGES = [
  { days: 0, label: 'เลยกำหนด + วันนี้' },
  { days: 7, label: 'ภายใน 7 วัน' },
  { days: 14, label: 'ภายใน 14 วัน' },
  { days: 30, label: 'ภายใน 30 วัน' }
]

export default function Vaccines() {
  const nav = useNavigate()
  const act = useAction()
  const toast = useToast()
  const [days, setDays] = useState(7)
  const [rows, reload] = useApi<any[]>('vaccinations.due', { days }, [days])
  const t = todayStr()

  const message = (r: any): string =>
    `สวัสดีค่ะ คุณ${r.owner_name.replace(/^คุณ/, '')} ริมปิงสัตวแพทย์ขอแจ้งว่า ${r.pet_name} ครบกำหนด${r.name} วันที่ ${thDate(r.next_due_date)} ` +
    `สามารถพาน้องมาได้ในเวลาทำการค่ะ 🐾`
  const copy = async (r: any): Promise<void> => {
    await navigator.clipboard.writeText(message(r))
    toast('คัดลอกข้อความแล้ว — วางใน LINE ได้เลย')
  }
  const enqueue = async (r: any): Promise<void> => {
    if (await act(() => api('queue.add', { pet_id: r.pet_id, reason: `ฉีด${r.name}` }), `${r.pet_name} เข้าคิวแล้ว`)) nav('/')
  }

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>นัดวัคซีน / ยาป้องกัน</h1>
          <div className="lead">สัตว์ที่ครบกำหนดหรือเลยกำหนด — โทรหรือส่ง LINE แจ้งเจ้าของ</div>
        </div>
      </div>
      <div className="subtabs">
        {RANGES.map((r) => (
          <button key={r.days} className={days === r.days ? 'active' : ''} onClick={() => setDays(r.days)}>{r.label}</button>
        ))}
      </div>
      {!rows?.length ? (
        <div className="card"><Empty icon={<Syringe />} text="ไม่มีรายการครบกำหนดในช่วงนี้" /></div>
      ) : (
        <div className="grid g2">
          {rows.map((r) => {
            const overdue = r.next_due_date < t
            const isToday = r.next_due_date === t
            return (
              <div key={r.id} className="card" style={{ borderLeft: `5px solid ${overdue ? 'var(--bad)' : isToday ? 'var(--orange)' : 'var(--sky)'}`, borderRadius: 0 }}>
                <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <SpeciesIcon species={r.species} />
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <h2><a onClick={() => nav(`/pets/${r.pet_id}`)}>{r.pet_name}</a></h2>
                      {overdue ? <span className="badge bad">เลยกำหนด</span> : isToday ? <span className="badge warn">วันนี้</span> : <span className="badge">อีกไม่กี่วัน</span>}
                    </div>
                    <div><b>{r.name}</b> · ครบกำหนด {thDate(r.next_due_date)} <span className="muted small">(ครั้งก่อน {thDate(r.given_date)})</span></div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      เจ้าของ <a onClick={() => nav(`/customers/${r.customer_id}`)}>{r.owner_name}</a>
                      {r.phone && <> · <Phone size={13} style={{ verticalAlign: -2 }} /> {r.phone}</>}
                      {r.line_id && <> · <MessageCircle size={13} style={{ verticalAlign: -2 }} /> {r.line_id}</>}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="secondary" onClick={() => copy(r)}><Copy /> คัดลอกข้อความแจ้งเตือน</button>
                  <button className="secondary" onClick={() => enqueue(r)}><ListPlus /> มาแล้ว → เข้าคิว</button>
                  <button className="ghost" onClick={() => nav(`/pos?customer=${r.customer_id}&pet=${r.pet_id}`)}><ShoppingBag /> คิดเงิน</button>
                  <button className="ghost" style={{ color: 'var(--muted)' }} onClick={async () => (await act(() => api('vaccinations.markDone', { id: r.id }), 'ปิดการแจ้งเตือนแล้ว')) && reload()}>
                    <BellOff /> ไม่ต้องเตือนแล้ว
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <Hint>เมื่อขายวัคซีนในหน้า "ขาย / คิดเงิน" (เลือกสัตว์ในบิล) ระบบจะบันทึกสมุดวัคซีนและคำนวณวันนัดครั้งถัดไปให้อัตโนมัติ และนัดเก่าจะหายจากรายการนี้เอง</Hint>
      </div>
    </>
  )
}
