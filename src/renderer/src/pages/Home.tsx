import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, UserPlus, ShoppingBag, Syringe, Stethoscope, Clock, CreditCard, CheckCircle2, ListPlus, FileText,
  TrendingUp, Receipt, AlertTriangle, X, ChevronRight, Banknote
} from 'lucide-react'
import { api, money, thDate } from '../api'
import { useApi, useAction, useSession, Modal, Field, SpeciesIcon, Hint, initial } from '../ui'
import { CustomerForm } from './forms'

const LANES = [
  { key: 'waiting', label: 'รอตรวจ', color: '#f08a33', icon: Clock },
  { key: 'in_exam', label: 'กำลังตรวจ', color: '#6b4fc4', icon: Stethoscope },
  { key: 'to_pay', label: 'รอชำระเงิน', color: '#2b7bc4', icon: CreditCard },
  { key: 'done', label: 'เสร็จแล้ว', color: '#17895a', icon: CheckCircle2 }
]

const REASONS = ['ตรวจรักษา', 'ฉีดวัคซีน', 'ตรวจติดตามอาการ', 'ทำแผล', 'ถ่ายพยาธิ/หยดเห็บหมัด', 'ซื้อยา/อาหาร']

export default function Home() {
  const nav = useNavigate()
  const act = useAction()
  const { me, refreshShift } = useSession()
  const [d, reloadDash] = useApi<any>('reports.dashboard')
  const [queue, reloadQueue] = useApi<any[]>('queue.today')
  const [enqueue, setEnqueue] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      reloadQueue()
      reloadDash()
    }, 20000)
    return () => clearInterval(t)
  }, [reloadQueue, reloadDash])

  const setStatus = async (q: any, status: string): Promise<void> => {
    await act(() => api('queue.setStatus', { id: q.id, status, vet_id: status === 'in_exam' && me.is_vet ? me.id : undefined }))
    reloadQueue()
    reloadDash()
  }
  const startExam = async (q: any): Promise<void> => {
    if (q.status === 'waiting') await setStatus(q, 'in_exam')
    nav(`/pets/${q.pet_id}?queue=${q.id}&exam=1`)
  }
  const pay = (q: any): void => void
    nav(`/pos?customer=${q.customer_id}&pet=${q.pet_id}&queue=${q.id}${q.visit_id ? `&visit=${q.visit_id}` : ''}${q.vet_id ? `&vet=${q.vet_id}` : ''}`)

  const max7 = Math.max(1, ...(d?.last7 ?? []).map((x: any) => x.total))

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>สวัสดีครับ {me.display_name}</h1>
          <div className="lead">วันนี้ {thDate(d?.date)} — เริ่มจากค้นหาลูกค้า หรือดูคิวด้านล่าง</div>
        </div>
      </div>

      <CustomerSearch onQueue={(pet) => setEnqueue(pet)} />

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="action" onClick={() => setCreating(true)}>
          <div className="ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><UserPlus size={28} /></div>
          <div><b>ลูกค้าใหม่</b><span>ลงทะเบียนเจ้าของและสัตว์เลี้ยง</span></div>
        </button>
        <button className="action" onClick={() => nav('/pos')}>
          <div className="ico" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}><ShoppingBag size={28} /></div>
          <div><b>ขายของหน้าร้าน</b><span>อาหาร ทราย ยา (ไม่ต้องตรวจ)</span></div>
        </button>
        <button className="action" onClick={() => nav('/vaccines')}>
          <div className="ico" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}><Syringe size={28} /></div>
          <div><b>นัดวัคซีน {d?.vaccines_due ? `(${d.vaccines_due})` : ''}</b><span>รายชื่อที่ต้องโทรแจ้งเจ้าของ</span></div>
        </button>
        <button className="action" onClick={() => nav('/finance/shift')}>
          <div className="ico" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Banknote size={28} /></div>
          <div><b>เปิด/ปิดกะ</b><span>นับเงินในลิ้นชักตอนเปิดและปิดร้าน</span></div>
        </button>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2 className="grow"><ListPlus /> คิววันนี้</h2>
          <span className="muted small">ค้นหาลูกค้าด้านบน แล้วกด "เข้าคิว"</span>
        </div>
        <div className="board">
          {LANES.map((lane) => {
            const items = (queue ?? []).filter((q) => q.status === lane.key)
            return (
              <div key={lane.key} className="lane">
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
                    {q.reason && <div className="badge" style={{ marginTop: 6 }}>{q.reason}</div>}
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
                      {q.status === 'waiting' && <button className="secondary" onClick={() => pay(q)}>ไม่ตรวจ → คิดเงิน</button>}
                      {q.status === 'in_exam' && <button onClick={() => startExam(q)}><FileText /> บันทึกการตรวจ</button>}
                      {q.status === 'in_exam' && <button className="secondary" onClick={() => setStatus(q, 'to_pay')}>ส่งไปชำระเงิน</button>}
                      {q.status === 'to_pay' && <button className="ok" onClick={() => pay(q)}><CreditCard /> รับเงิน</button>}
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
            <div className="stat clickable" onClick={() => nav('/finance/outstanding')}>
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

      <div style={{ marginTop: 18 }}>
        <Hint>
          <b>ขั้นตอนประจำวัน:</b> เปิดกะ → ลูกค้ามา ค้นหาชื่อแล้วกด "เข้าคิว" → หมอกด "เริ่มตรวจ" บันทึกอาการ → หน้าร้านกด "รับเงิน" พิมพ์ใบเสร็จ → ปิดร้านกด "ปิดกะ" นับเงิน
        </Hint>
      </div>

      {enqueue && (
        <EnqueueModal
          pet={enqueue}
          onClose={() => setEnqueue(null)}
          onDone={() => {
            setEnqueue(null)
            reloadQueue()
            reloadDash()
            refreshShift()
          }}
        />
      )}
      {creating && <CustomerForm onClose={() => setCreating(false)} onSaved={(id) => nav(`/customers/${id}?newpet=1`)} />}
    </>
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
                      <button onClick={() => { setOpen(false); onQueue({ ...p, owner_name: c.name }) }}><ListPlus /> เข้าคิว</button>
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
