import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, ChevronLeft, ChevronRight, CalendarCheck, Stethoscope, Syringe, CalendarPlus, ListPlus } from 'lucide-react'
import { api, money, todayStr, longDate } from '../api'
import { useApi, useAction, Empty, SpeciesIcon } from '../ui'
import { AppointmentForm } from './forms'

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const pad = (n: number): string => String(n).padStart(2, '0')

/** Month overview: bookings, visits, vaccines due and sales per day; click a day for its list. */
export default function Calendar() {
  const nav = useNavigate()
  const act = useAction()
  const today = todayStr()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [picked, setPicked] = useState(today)
  const [booking, setBooking] = useState(false)
  const [days, reloadMonth] = useApi<Record<string, any>>('calendar.month', { month }, [month])
  const [day, reloadDay] = useApi<any>('calendar.day', { date: picked }, [picked])

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const count = new Date(y, m, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)]
  const shift = (n: number): void => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }
  const totals = Object.values(days ?? {}).reduce(
    (t: any, d: any) => ({ appts: t.appts + d.appts, queue: t.queue + d.queue, vaccines: t.vaccines + d.vaccines, sales: t.sales + d.sales }),
    { appts: 0, queue: 0, vaccines: 0, sales: 0 }
  )
  const arrived = async (a: any): Promise<void> => {
    if (await act(() => api('queue.add', { pet_id: a.pet_id, appointment_id: a.id }), `${a.pet_name} เข้าคิวแล้ว`)) {
      reloadDay()
      reloadMonth()
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem indigo"><CalendarRange /></span> ปฏิทิน</h1>
          <div className="lead">ภาพรวมทั้งเดือน — กดที่วันเพื่อดูรายชื่อนัดและคิวของวันนั้น</div>
        </div>
        <button className="big" onClick={() => setBooking(true)}><CalendarPlus /> จองนัด</button>
      </div>

      <div className="cal-layout">
        <div className="card">
          <div className="cal-head">
            <button className="secondary" aria-label="เดือนก่อน" onClick={() => shift(-1)}><ChevronLeft /></button>
            <h2>{TH_MONTHS[m - 1]} {y + 543}</h2>
            <button className="secondary" aria-label="เดือนถัดไป" onClick={() => shift(1)}><ChevronRight /></button>
            <div className="grow" />
            <button className="ghost" onClick={() => { setMonth(today.slice(0, 7)); setPicked(today) }}>วันนี้</button>
          </div>
          <div className="cal-sum">
            <span className="dotlabel rose">นัด {totals.appts}</span>
            <span className="dotlabel violet">มาตรวจ {totals.queue}</span>
            <span className="dotlabel green">วัคซีนครบกำหนด {totals.vaccines}</span>
            <span className="dotlabel gold">ยอดขาย {money(totals.sales)}</span>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w, i) => <div key={w} className={`cal-wd ${i === 0 ? 'sun' : ''}`}>{w}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} className="cal-cell blank" />
              const x = days?.[d]
              return (
                <button key={d} className={`cal-cell ${d === today ? 'today' : ''} ${d === picked ? 'picked' : ''} ${d < today ? 'past' : ''}`} onClick={() => setPicked(d)}>
                  <span className="cal-n">{Number(d.slice(8))}</span>
                  {x?.appts ? <span className="cal-tag rose">นัด {x.appts}</span> : null}
                  {x?.queue ? <span className="cal-tag violet">ตรวจ {x.queue}</span> : null}
                  {x?.vaccines ? <span className="cal-tag green">วัคซีน {x.vaccines}</span> : null}
                  {x?.sales ? <span className="cal-sales">{money(x.sales).replace(/\.00$/, '')}</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card day-panel">
          <h2>{longDate(picked)}</h2>
          <section>
            <h3><CalendarCheck size={18} /> นัดหมาย ({day?.appointments.length ?? 0})</h3>
            {day?.appointments.length === 0 && <Empty text="ไม่มีนัด" />}
            {day?.appointments.map((a: any) => (
              <div key={a.id} className="day-row">
                <span className="time">{a.appt_time ?? '—'}</span>
                <SpeciesIcon species={a.species} size={18} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{a.pet_name}</b> <span className="muted small">{a.owner_name}</span>
                  <div className="small">{a.topic}</div>
                </div>
                {a.status === 'done' ? (
                  <span className="badge ok">มาแล้ว</span>
                ) : a.status === 'no_show' ? (
                  <span className="badge bad">ไม่มา</span>
                ) : picked === today ? (
                  <button className="ok" onClick={() => arrived(a)}><ListPlus /> มาถึง</button>
                ) : (
                  <span className="badge warn">รอวันนัด</span>
                )}
              </div>
            ))}
          </section>
          <section>
            <h3><Stethoscope size={18} /> มาตรวจ / คิว ({day?.queue.length ?? 0})</h3>
            {day?.queue.length === 0 && <Empty text="ไม่มีคิว" />}
            {day?.queue.map((q: any) => (
              <div key={q.id} className="day-row clickable" onClick={() => nav(`/pets/${q.pet_id}`)}>
                <span className="time">{q.created_at.slice(11, 16)}</span>
                <SpeciesIcon species={q.species} size={18} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{q.pet_name}</b> <span className="muted small">{q.owner_name}</span>
                  <div className="small">{q.reason}</div>
                </div>
                <span className={`badge ${q.appointment_id ? 'rose' : 'sky'}`}>{q.appointment_id ? 'นัด' : 'Walk-in'}</span>
              </div>
            ))}
          </section>
          <section>
            <h3><Syringe size={18} /> วัคซีนครบกำหนด ({day?.vaccines.length ?? 0})</h3>
            {day?.vaccines.length === 0 && <Empty text="ไม่มี" />}
            {day?.vaccines.map((v: any) => (
              <div key={v.id} className="day-row clickable" onClick={() => nav(`/pets/${v.pet_id}`)}>
                <SpeciesIcon species={v.species} size={18} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{v.pet_name}</b> <span className="muted small">{v.owner_name} · {v.phone}</span>
                  <div className="small">{v.name}</div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      {booking && (
        <AppointmentForm
          initial={{ appt_date: picked >= today ? picked : today }}
          onClose={() => setBooking(false)}
          onSaved={() => { setBooking(false); reloadMonth(); reloadDay() }}
        />
      )}
    </>
  )
}
