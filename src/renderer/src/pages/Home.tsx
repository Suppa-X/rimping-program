import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, UserPlus, ShoppingBag, Clock, Clock3, CreditCard, CheckCircle2, ListPlus, TrendingUp, Receipt, AlertTriangle,
  ChevronRight, Banknote, CalendarCheck, Footprints
} from 'lucide-react'
import { api, money, thDate, todayStr, longDate, isClosed } from '../api'
import { useApi, useAction, useSession, useClosedDays, Modal, Field, SpeciesIcon, Empty, initial } from '../ui'
import { CustomerForm } from './forms'
import { payUrl } from './Exam'

const REASONS = ['ตรวจรักษา', 'ฉีดวัคซีน', 'ตรวจติดตามอาการ', 'ทำแผล', 'ถ่ายพยาธิ/หยดเห็บหมัด', 'ซื้อยา/อาหาร']
const STATUS_TONE: Record<string, string> = { waiting: 'orange', in_exam: 'violet', to_pay: 'emerald', done: 'slate' }
const STATUS_TEXT: Record<string, string> = { waiting: 'รอตรวจ', in_exam: 'กำลังตรวจ', to_pay: 'รอชำระ', done: 'เสร็จแล้ว' }

export default function Home() {
  const nav = useNavigate()
  const act = useAction()
  const { me, shift, refreshShift } = useSession()
  const [d, reloadDash] = useApi<any>('reports.dashboard')
  const [queue, reloadQueue] = useApi<any[]>('queue.today')
  const [appts, reloadAppts] = useApi<any[]>('appointments.list', { from: todayStr(), to: todayStr() })
  const [enqueue, setEnqueue] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const closed = useClosedDays()

  const reloadAll = (): void => {
    reloadQueue()
    reloadDash()
    reloadAppts()
  }
  useEffect(() => {
    const t = setInterval(reloadAll, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const arrived = async (a: any): Promise<void> => {
    if (await act(() => api('queue.add', { pet_id: a.pet_id, appointment_id: a.id }), `${a.pet_name} เข้าคิวแล้ว (มีนัด)`)) reloadAll()
  }
  const openQueue = (q: any): void => {
    nav(q.status === 'to_pay' ? payUrl(q) : q.status === 'done' && q.invoice_id ? `/invoices/${q.invoice_id}` : '/exam')
  }

  const max7 = Math.max(1, ...(d?.last7 ?? []).map((x: any) => x.total))
  const pending = (appts ?? []).filter((a) => a.status === 'pending')
  const hour = new Date().getHours()
  const steps = [
    { n: 1, label: 'เปิดกะ', done: !!shift, to: '/finance/shift', tone: 'gold' },
    { n: 2, label: 'รับลูกค้าเข้าคิว', done: (queue ?? []).length > 0, to: '/', tone: 'sky' },
    { n: 3, label: 'ตรวจรักษา', done: false, to: '/exam', tone: 'violet' },
    { n: 4, label: 'คิดเงิน + ใบเสร็จ', done: false, to: '/billing', tone: 'emerald' },
    { n: 5, label: 'ปิดกะ นับเงิน', done: false, to: '/finance/shift', tone: 'coral' }
  ]

  return (
    <>
      <div className="hero">
        <div className="hero-text">
          <div className="hero-date">{longDate(todayStr())}</div>
          <h1>สวัสดีครับ {me.display_name}</h1>
          <div className="hero-sub">ลูกค้ามาถึง → ค้นหาชื่อแล้วกด "เข้าคิว" · ลูกค้าที่มีนัด กด "มาถึงแล้ว"</div>
          {isClosed(todayStr(), closed) && <div className="hero-off">วันนี้เป็นวันหยุดประจำสัปดาห์ของร้าน</div>}
        </div>
        <div className="hero-kpis">
          <button className="kpi t-orange" onClick={() => nav('/exam')}><Clock /><b>{d?.queue_to_exam ?? 0}</b><span>รอตรวจ</span></button>
          <button className="kpi t-emerald" onClick={() => nav('/billing')}><CreditCard /><b>{d?.queue_to_pay ?? 0}</b><span>รอชำระ</span></button>
          <button className="kpi t-rose" onClick={() => nav('/appointments')}><CalendarCheck /><b>{pending.length}</b><span>นัดที่ยังไม่มา</span></button>
          <button className="kpi t-gold" onClick={() => nav('/finance')}><TrendingUp /><b>{money(d?.sales_total ?? 0).replace(/\.00$/, '')}</b><span>ยอดขายวันนี้</span></button>
        </div>
      </div>

      <div className="daysteps">
        {steps.map((s) => (
          <button key={s.n} className={`daystep ${s.tone} ${s.done ? 'done' : ''}`} onClick={() => nav(s.to)}>
            <span className="n">{s.done ? <CheckCircle2 size={18} /> : s.n}</span> {s.label}
          </button>
        ))}
      </div>

      <div className="arrive">
        <div className="card tinted sky">
          <div className="card-head">
            <span className="gem sky"><Footprints /></span>
            <div className="grow">
              <h2>ลูกค้ามาเอง (Walk-in)</h2>
              <div className="muted small">ลูกค้าเก่า: พิมพ์ชื่อ เบอร์ หรือชื่อสัตว์ แล้วกด "เข้าคิว" · ลูกค้าใหม่: กด "ลงทะเบียนลูกค้าใหม่"</div>
            </div>
          </div>
          <CustomerSearch onQueue={(pet) => setEnqueue(pet)} />
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => setCreating(true)}><UserPlus /> ลงทะเบียนลูกค้าใหม่</button>
            <button className="secondary" onClick={() => nav('/shop')}><ShoppingBag /> ซื้อของอย่างเดียว (ไม่ตรวจ)</button>
          </div>
        </div>
        <div className="card tinted rose">
          <div className="card-head">
            <span className="gem rose"><CalendarCheck /></span>
            <div className="grow">
              <h2>มีนัดวันนี้ ({appts?.length ?? 0})</h2>
              <div className="muted small">ลูกค้ามาตามนัด กด "มาถึงแล้ว" ระบบจะเข้าคิวให้เลย</div>
            </div>
          </div>
          {appts?.length === 0 && <Empty text="วันนี้ไม่มีนัด" />}
          <div className="stack" style={{ gap: 8 }}>
            {(appts ?? []).map((a) => (
              <div key={a.id} className="appt-row">
                <span className="time">{a.appt_time ?? '—'}</span>
                <SpeciesIcon species={a.species} size={18} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{a.pet_name}</b> <span className="muted small">{a.owner_name}</span>
                  <div className="small">{a.topic}</div>
                </div>
                {a.status === 'pending' ? (
                  <button className="ok" onClick={() => arrived(a)}><ListPlus /> มาถึงแล้ว</button>
                ) : (
                  <span className={`badge ${a.status === 'done' ? 'ok' : 'bad'}`}>{a.status === 'done' ? 'เข้าคิวแล้ว' : 'ไม่มา'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <span className="gem violet"><Clock3 /></span>
          <h2 className="grow">ตารางวันนี้ตามช่วงเวลา</h2>
          <span className="legend"><i className="rose" /> นัดที่ยังไม่มา <i className="orange" /> รอตรวจ <i className="violet" /> กำลังตรวจ <i className="emerald" /> รอชำระ <i className="slate" /> เสร็จ</span>
        </div>
        <Timeline queue={queue ?? []} appts={pending} hour={hour} onQueue={openQueue} onAppt={arrived} />
      </div>

      {d && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', marginTop: 18 }}>
          <div className="grid g2">
            <div className="stat clickable" onClick={() => nav('/finance')}>
              <div className="ico ok"><TrendingUp /></div>
              <div><div className="label">ยอดขายวันนี้</div><div className="value">{money(d.sales_total)}</div><div className="sub">{d.bills} บิล</div></div>
            </div>
            <div className="stat clickable" onClick={() => nav('/finance/bills')}>
              <div className="ico"><Banknote /></div>
              <div>
                <div className="label">รับเงินวันนี้</div>
                <div className="value">{money(Object.entries(d.received).filter(([m]) => m !== 'deposit').reduce((t, [, v]) => t + (v as number), 0))}</div>
                <div className="sub">เงินสด {money(d.received.cash ?? 0)} · โอน/QR {money((d.received.transfer ?? 0) + (d.received.promptpay ?? 0))}</div>
              </div>
            </div>
            <div className="stat clickable" onClick={() => nav('/billing')}>
              <div className={`ico ${d.outstanding_count ? 'bad' : ''}`}><Receipt /></div>
              <div><div className="label">ลูกค้าค้างชำระ</div><div className="value">{money(d.outstanding_amount)}</div><div className="sub">{d.outstanding_count} บิล</div></div>
            </div>
            <div className="stat clickable" onClick={() => nav('/products?low=1')}>
              <div className={`ico ${d.low_stock ? 'warn' : ''}`}><AlertTriangle /></div>
              <div><div className="label">สินค้าใกล้หมด</div><div className="value">{d.low_stock}</div><div className="sub">รายการ — กดเพื่อดู</div></div>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="grow"><TrendingUp /> ยอดขาย 7 วันล่าสุด</h2>
              <span className="muted small">เดือนนี้ {money(d.month_total)}</span>
            </div>
            <div className="chart">
              {d.last7.map((x: any, i: number) => (
                <div key={x.day} className={`col ${i === 6 ? 'today' : ''}`}>
                  <div className="val">{x.total ? Math.round(x.total).toLocaleString() : ''}</div>
                  <div className="colbar" style={{ height: `${(x.total / max7) * 100}%` }} />
                  <div className="lbl">{i === 6 ? 'วันนี้' : thDate(x.day).split(' ').slice(0, 2).join(' ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {enqueue && (
        <EnqueueModal
          pet={enqueue}
          onClose={() => setEnqueue(null)}
          onDone={() => {
            setEnqueue(null)
            reloadAll()
            refreshShift()
          }}
        />
      )}
      {creating && <CustomerForm onClose={() => setCreating(false)} onSaved={(id) => nav(`/customers/${id}?newpet=1`)} />}
    </>
  )
}

/** Hour rows from opening to closing; queue entries sit at their booked time (or arrival time for walk-ins). */
function Timeline(props: { queue: any[]; appts: any[]; hour: number; onQueue: (q: any) => void; onAppt: (a: any) => void }) {
  const at = (t?: string | null): number => (t ? Number(t.slice(0, 2)) : -1)
  const qHour = (q: any): number => (q.appointment_id && q.appt_time ? at(q.appt_time) : at(q.created_at.slice(11, 16)))
  const used = [...props.queue.map(qHour), ...props.appts.map((a) => at(a.appt_time)).filter((h) => h >= 0)]
  const from = Math.min(8, ...used)
  const to = Math.max(19, ...used)
  const noTime = props.appts.filter((a) => !a.appt_time)
  return (
    <div className="tl">
      {noTime.length > 0 && (
        <div className="tl-row">
          <div className="tl-time">ไม่ระบุเวลา</div>
          <div className="tl-items">
            {noTime.map((a) => <ApptChip key={a.id} a={a} onClick={() => props.onAppt(a)} />)}
          </div>
        </div>
      )}
      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => {
        const qs = props.queue.filter((q) => qHour(q) === h)
        const as = props.appts.filter((a) => at(a.appt_time) === h)
        return (
          <div key={h} className={`tl-row ${h === props.hour ? 'now' : ''} ${qs.length + as.length === 0 ? 'empty' : ''}`}>
            <div className="tl-time">{String(h).padStart(2, '0')}:00{h === props.hour && <span className="now-tag">ตอนนี้</span>}</div>
            <div className="tl-items">
              {as.map((a) => <ApptChip key={a.id} a={a} onClick={() => props.onAppt(a)} />)}
              {qs.map((q) => (
                <button key={q.id} className={`tl-chip t-${STATUS_TONE[q.status]}`} onClick={() => props.onQueue(q)} title="กดเพื่อไปทำงานต่อ">
                  <b>#{q.queue_no} {q.pet_name}</b>
                  <span>{q.appointment_id ? `นัด ${q.appt_time ?? ''}` : `Walk-in ${q.created_at.slice(11, 16)}`} · {STATUS_TEXT[q.status]}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApptChip({ a, onClick }: { a: any; onClick: () => void }) {
  return (
    <button className="tl-chip t-rose t-dashed" onClick={onClick} title='กดเมื่อลูกค้ามาถึง เพื่อเข้าคิว'>
      <b>{a.appt_time ?? ''} {a.pet_name}</b>
      <span>นัด: {a.topic} · ยังไม่มา</span>
    </button>
  )
}

function CustomerSearch({ onQueue }: { onQueue: (pet: any) => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!q.trim()) return setRows([])
    const t = setTimeout(async () => {
      const list = await api<any[]>('customers.search', { q, limit: 8 })
      setRows(await Promise.all(list.map((c) => api('customers.get', { id: c.id }))))
      setOpen(true)
    }, 200)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const off = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', off)
    return () => window.removeEventListener('mousedown', off)
  }, [])
  return (
    <div className="bigsearch" ref={box}>
      <Search />
      <input
        autoFocus
        placeholder="ค้นหาลูกค้า — พิมพ์ชื่อเจ้าของ เบอร์โทร หรือชื่อสัตว์เลี้ยง"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => rows.length && setOpen(true)}
      />
      {open && q.trim() && (
        <div className="results">
          {rows.length === 0 && (
            <div className="result">
              <div className="who muted">ไม่พบ "{q}"</div>
              <button onClick={() => nav(`/customers?new=1&q=${encodeURIComponent(q)}`)}><UserPlus /> เพิ่มเป็นลูกค้าใหม่</button>
            </div>
          )}
          {rows.map((c) => (
            <div key={c.id} className="result">
              <div className="avatar">{initial(c.name)}</div>
              <div className="who">
                <div className="row" style={{ gap: 8 }}>
                  <b style={{ fontSize: 17 }}>{c.name}</b>
                  <span className="muted">{c.phone}</span>
                  {c.outstanding > 0 && <span className="badge bad">ค้าง {money(c.outstanding)}</span>}
                  {c.deposit_balance > 0 && <span className="badge ok">มัดจำ {money(c.deposit_balance)}</span>}
                </div>
                <div className="pets">
                  {c.pets.length === 0 && <span className="muted small">ยังไม่มีสัตว์เลี้ยง</span>}
                  {c.pets.map((p: any) => (
                    <div key={p.id} className="pet-row">
                      <SpeciesIcon species={p.species} size={14} />
                      <b>{p.name}</b>
                      <span className="muted small">{p.species} {p.breed && `· ${p.breed}`}</span>
                      <div className="grow" />
                      <button onClick={() => { setOpen(false); onQueue({ ...p, owner_name: c.name }) }}><ListPlus /> เข้าคิว (Walk-in)</button>
                      <button className="secondary" onClick={() => nav(`/pets/${p.id}`)}>ประวัติ</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <button className="secondary" onClick={() => nav(`/pos?customer=${c.id}`)}><ShoppingBag /> ขายของ</button>
                <button className="ghost" onClick={() => nav(`/customers/${c.id}`)}>ข้อมูลลูกค้า <ChevronRight /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EnqueueModal(props: { pet: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('ตรวจรักษา')
  const act = useAction()
  const save = async (): Promise<void> => {
    const r = await act(() => api<any>('queue.add', { pet_id: props.pet.id, reason }))
    if (r) props.onDone()
  }
  return (
    <Modal
      title={`เข้าคิว — ${props.pet.name}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button className="big" onClick={save}><ListPlus /> เข้าคิว</button>
        </>
      }
    >
      <div className="row">
        <SpeciesIcon species={props.pet.species} />
        <div>
          <h2>{props.pet.name}</h2>
          <div className="muted">เจ้าของ: {props.pet.owner_name}</div>
        </div>
      </div>
      <Field label="มาด้วยเรื่อง">
        <div className="chips">
          {REASONS.map((r) => (
            <button key={r} className={`chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </Field>
      <Field label="หรือพิมพ์เอง">
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  )
}
