import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, User, Trash2, CreditCard, Minus, Plus, Banknote, Landmark, QrCode, Wallet, ArrowRight, ArrowLeft, Check, AlertTriangle, Stethoscope } from 'lucide-react'
import { api, money, openPrint, CATEGORY_LABEL, METHOD_LABEL } from '../api'
import { useApi, useAction, useSession, ApprovalModal, Empty, initial } from '../ui'
import { CustomerForm } from './forms'

interface Line {
  key: number
  product: any
  name: string
  qty: number
  unit_price: number
  discount: number
  vet_id: string
  instruction: string
}

const CAT_COLOR: Record<string, string> = {
  service: '#2b7bc4', procedure: '#6b4fc4', vaccine: '#c2416b', medicine: '#17895a', food: '#d9741c', supply: '#5a6b7c', other: '#5a6b7c'
}
const METHOD_ICON: Record<string, any> = { cash: Banknote, transfer: Landmark, promptpay: QrCode, card: CreditCard, deposit: Wallet }
let lineKey = 1
const r2 = (n: number): number => Math.round(n * 100) / 100

export default function Pos() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { me, shift, refreshShift } = useSession()
  const act = useAction()
  const [vets] = useApi<any[]>('users.vets')
  const [products] = useApi<any[]>('products.list', {})

  const [step, setStep] = useState(1)
  const [customer, setCustomer] = useState<any>(null)
  const [walkIn, setWalkIn] = useState(false)
  const [petId, setPetId] = useState('')
  const [visitId, setVisitId] = useState('')
  const [queueId, setQueueId] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [billDiscount, setBillDiscount] = useState('')
  const [discountPct, setDiscountPct] = useState(false)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')

  const defaultVet = useMemo(() => {
    if (params.get('vet')) return params.get('vet')!
    if (me.is_vet) return me.id
    return vets?.length === 1 ? vets[0].id : ''
  }, [vets, me, params])

  useEffect(() => {
    const cid = params.get('customer')
    setVisitId(params.get('visit') ?? '')
    setQueueId(params.get('queue') ?? '')
    if (cid)
      api('customers.get', { id: cid }).then((c) => {
        setCustomer(c)
        setWalkIn(false)
        setPetId(params.get('pet') ?? (c.pets.length === 1 ? c.pets[0].id : ''))
        setStep(2)
      })
  }, [params])

  const afterLines = lines.reduce((t, l) => t + l.qty * l.unit_price - l.discount, 0)
  const billDiscountBaht = r2(discountPct ? (afterLines * (Number(billDiscount) || 0)) / 100 : Number(billDiscount) || 0)

  useEffect(() => {
    if (!lines.length) return setPreview(null)
    const t = setTimeout(() => {
      api('pos.preview', {
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty, unit_price: l.unit_price, discount: l.discount })),
        bill_discount: billDiscountBaht
      })
        .then(setPreview)
        .catch(() => setPreview(null))
    }, 120)
    return () => clearTimeout(t)
  }, [lines, billDiscountBaht])

  const add = (p: any): void =>
    setLines((ls) => {
      const same = ls.find((l) => l.product.id === p.id)
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { key: lineKey++, product: p, name: p.name, qty: 1, unit_price: p.price, discount: 0, vet_id: p.needs_vet ? defaultVet : '', instruction: p.category === 'medicine' ? p.label_th ?? '' : '' }]
    })
  const patch = (key: number, v: Partial<Line>): void => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...v } : l)))
  const remove = (key: number): void => setLines((ls) => ls.filter((l) => l.key !== key))
  const reset = (): void => {
    setLines([])
    setBillDiscount('')
    setNote('')
    setCustomer(null)
    setWalkIn(false)
    setPetId('')
    setStep(1)
    nav('/pos', { replace: true })
  }

  const shown = (products ?? []).filter(
    (p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
  )
  const pet = customer?.pets?.find((p: any) => p.id === petId)
  const missingVet = lines.some((l) => l.product.needs_vet && !l.vet_id)
  const who = customer ? customer.name : walkIn ? 'ลูกค้าทั่วไป' : null

  const checkout = async (payments: { method: string; amount: number }[], approval?: any): Promise<any> => {
    const res = await api<any>('pos.checkout', {
      customer_id: customer?.id,
      pet_id: petId || undefined,
      visit_id: visitId || undefined,
      queue_id: queueId || undefined,
      items: lines.map((l) => ({ product_id: l.product.id, name: l.name, qty: l.qty, unit_price: l.unit_price, discount: l.discount, vet_id: l.vet_id || null, instruction: l.instruction || undefined })),
      bill_discount: billDiscountBaht,
      payments,
      note,
      approval
    })
    refreshShift()
    openPrint(`/print/invoice/${res.id}`)
    if (lines.some((l) => l.product.category === 'medicine')) openPrint(`/print/labels/${res.id}`)
    reset()
    if (queueId) nav('/')
    return res
  }

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>ขาย / คิดเงิน</h1>
          <div className="lead">{who ? <>บิลของ <b>{who}</b>{pet && ` · ${pet.name}`}</> : 'เริ่มจากเลือกลูกค้า หรือกด "ลูกค้าทั่วไป" ถ้าแค่ซื้อของ'}</div>
        </div>
        {(lines.length > 0 || who) && <button className="secondary" onClick={reset}><Trash2 /> เริ่มบิลใหม่</button>}
      </div>

      {!shift && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={18} /> ยังไม่ได้เปิดกะ — เลือกสินค้าได้ แต่ต้องเปิดกะก่อนรับเงิน
          <button className="orange" style={{ marginLeft: 'auto' }} onClick={() => nav('/finance/shift')}>เปิดกะ</button>
        </div>
      )}

      <div className="steps">
        {[
          { n: 1, t: 'เลือกลูกค้า', d: who ?? 'ใครมาซื้อ/มารักษา' },
          { n: 2, t: 'เลือกรายการ', d: lines.length ? `${lines.length} รายการ` : 'บริการ ยา สินค้า' },
          { n: 3, t: 'รับเงิน', d: preview ? `${money(preview.total)} บาท` : 'เงินสด โอน QR' }
        ].map((s) => (
          <div
            key={s.n}
            className={`step ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}
            onClick={() => {
              if (s.n === 1 || (s.n === 2 && who) || (s.n === 3 && preview && !missingVet)) setStep(s.n)
            }}
          >
            <div className="n">{step > s.n ? <Check size={18} /> : s.n}</div>
            <div><b>{s.t}</b><span className="small">{s.d}</span></div>
          </div>
        ))}
      </div>

      {step === 1 && <WaitingToPay />}
      {step === 1 && (
        <StepCustomer
          customer={customer}
          petId={petId}
          onPick={(c) => { setCustomer(c); setWalkIn(false); setPetId(c?.pets?.length === 1 ? c.pets[0].id : '') }}
          onPet={setPetId}
          onWalkIn={() => { setCustomer(null); setWalkIn(true); setPetId(''); setStep(2) }}
          onNext={() => setStep(2)}
        />
      )}

      {step >= 2 && (
        <div className="pos">
          {step === 2 ? (
            <div className="card">
              <div className="bigsearch" style={{ marginBottom: 12 }}>
                <Search />
                <input autoFocus placeholder="ค้นหาสินค้า/บริการ หรือสแกนบาร์โค้ด แล้วกด Enter" value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const exact = (products ?? []).find((p) => p.sku && p.sku.toLowerCase() === q.trim().toLowerCase())
                    const hit = exact ?? (shown.length === 1 ? shown[0] : null)
                    if (hit) { add(hit); setQ('') }
                  }} style={{ fontSize: 17, padding: '12px 14px 12px 52px' }} />
              </div>
              <div className="chips" style={{ marginBottom: 14 }}>
                <button className={`chip ${cat === '' ? 'active' : ''}`} onClick={() => setCat('')}>ทั้งหมด</button>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <button key={k} className={`chip ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>{v}</button>
                ))}
              </div>
              <div className="product-grid">
                {shown.map((p) => {
                  const inCart = lines.find((l) => l.product.id === p.id)
                  return (
                    <button key={p.id} className="product-tile" style={inCart ? { borderColor: 'var(--blue)', background: 'var(--blue-soft)' } : undefined} onClick={() => add(p)}>
                      <span className="cat" style={{ color: CAT_COLOR[p.category] }}>{CATEGORY_LABEL[p.category]}</span>
                      <span>{p.name}</span>
                      <span className="p">{money(p.price)}</span>
                      {p.track_stock ? (
                        <span className="tiny" style={{ color: p.stock_qty <= p.min_stock ? 'var(--warn)' : 'var(--muted)' }}>
                          คงเหลือ {p.stock_qty} {p.unit}
                        </span>
                      ) : null}
                      {inCart && <span className="badge" style={{ alignSelf: 'flex-start' }}>ในบิล × {inCart.qty}</span>}
                    </button>
                  )
                })}
              </div>
              {shown.length === 0 && <Empty text="ไม่พบสินค้า" />}
            </div>
          ) : (
            <StepPay
              total={preview?.total ?? 0}
              customer={customer}
              needsApproval={!!preview?.needs_approval}
              discountPct={preview?.discount_pct ?? 0}
              canPay={!!shift}
              onBack={() => setStep(2)}
              onSubmit={(pays, approval) => act(() => checkout(pays, approval), 'บันทึกบิลแล้ว — กำลังเปิดใบเสร็จ')}
            />
          )}

          <div className="card cart">
            <div className="card-head">
              <h2 className="grow">รายการในบิล</h2>
              {pet && <span className="badge purple">{pet.name}</span>}
            </div>
            {visitId && <div className="alert info small" style={{ marginBottom: 8 }}><Stethoscope size={16} /> ต่อจากบันทึกการตรวจ</div>}
            {lines.length === 0 && <div className="muted center" style={{ padding: '30px 0' }}>กดเลือกสินค้า/บริการทางซ้าย</div>}
            {lines.map((l) => (
              <div key={l.key} className="cart-line">
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <div className="grow bold">{l.name}</div>
                  <div className="bold num">{money(l.qty * l.unit_price - l.discount)}</div>
                </div>
                {step === 2 ? (
                  <>
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <div className="qty">
                        <button onClick={() => (l.qty > 1 ? patch(l.key, { qty: l.qty - 1 }) : remove(l.key))} aria-label="ลด"><Minus /></button>
                        <input type="number" value={l.qty} onChange={(e) => patch(l.key, { qty: Number(e.target.value) })} />
                        <button onClick={() => patch(l.key, { qty: l.qty + 1 })} aria-label="เพิ่ม"><Plus /></button>
                      </div>
                      <span className="muted small">×</span>
                      <input type="number" style={{ width: 90, padding: '6px 8px' }} value={l.unit_price} onChange={(e) => patch(l.key, { unit_price: Number(e.target.value) })} title="ราคาต่อหน่วย" />
                      <input type="number" style={{ width: 72, padding: '6px 8px' }} placeholder="ลด ฿" value={l.discount || ''} onChange={(e) => patch(l.key, { discount: Number(e.target.value) || 0 })} title="ส่วนลดรายการ" />
                      <button className="ghost" style={{ color: 'var(--bad)', marginLeft: 'auto' }} aria-label="ลบ" onClick={() => remove(l.key)}><Trash2 /></button>
                    </div>
                    {l.product.category === 'medicine' && (
                      <input style={{ marginTop: 8, padding: '7px 10px' }} placeholder="วิธีใช้ยา (พิมพ์บนฉลาก) เช่น กินครั้งละ 1 เม็ด เช้า-เย็น หลังอาหาร" value={l.instruction} onChange={(e) => patch(l.key, { instruction: e.target.value })} />
                    )}
                    {l.product.needs_vet ? (
                      <select style={{ marginTop: 8, padding: '7px 10px', borderColor: l.vet_id ? undefined : 'var(--bad)' }} value={l.vet_id} onChange={(e) => patch(l.key, { vet_id: e.target.value })}>
                        <option value="">— เลือกสัตวแพทย์ผู้ทำ —</option>
                        {vets?.map((v) => <option key={v.id} value={v.id}>สัตวแพทย์: {v.display_name}</option>)}
                      </select>
                    ) : null}
                  </>
                ) : (
                  <div className="muted small">{l.qty} × {money(l.unit_price)}{l.discount ? ` ลด ${money(l.discount)}` : ''}</div>
                )}
              </div>
            ))}
            {lines.length > 0 && (
              <>
                {step === 2 && (
                  <>
                    <div className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
                      <span className="grow">ส่วนลดท้ายบิล</span>
                      <input type="number" min="0" style={{ width: 100 }} value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />
                      <div className="chips" style={{ flexWrap: 'nowrap' }}>
                        <button className={`chip ${!discountPct ? 'active' : ''}`} onClick={() => setDiscountPct(false)}>฿</button>
                        <button className={`chip ${discountPct ? 'active' : ''}`} onClick={() => setDiscountPct(true)}>%</button>
                      </div>
                    </div>
                    <input style={{ marginTop: 8 }} placeholder="หมายเหตุในบิล (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
                  </>
                )}
                {preview && (
                  <div className="totals" style={{ marginTop: 12 }}>
                    <div><span>รวม</span><span className="num">{money(preview.subtotal)}</span></div>
                    {preview.line_discount + preview.bill_discount > 0 && (
                      <div style={{ color: 'var(--bad)' }}><span>ส่วนลด ({preview.discount_pct}%)</span><span className="num">-{money(preview.line_discount + preview.bill_discount)}</span></div>
                    )}
                    {preview.vat_enabled && (
                      <div className="muted small"><span>VAT {preview.vat_rate}% {preview.vat_inclusive ? '(รวมในราคาแล้ว)' : ''}</span><span className="num">{money(preview.vat_amount)}</span></div>
                    )}
                    <div className="grand"><span>ยอดสุทธิ</span><span className="num">{money(preview.total)}</span></div>
                    {preview.needs_approval && <div className="alert warn small">ส่วนลดเกินสิทธิ์ของคุณ ({me.max_discount_pct}%) — ตอนรับเงินจะขอ PIN ผู้จัดการ</div>}
                  </div>
                )}
                {step === 2 && (
                  <>
                    <button className="big block ok" style={{ marginTop: 14 }} disabled={!preview || missingVet} onClick={() => setStep(3)}>
                      ถัดไป: รับเงิน <ArrowRight />
                    </button>
                    {missingVet && <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>เลือกสัตวแพทย์ในรายการบริการก่อน (ใช้คิดค่า DF)</div>}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function WaitingToPay() {
  const nav = useNavigate()
  const [q] = useApi<any[]>('queue.today')
  const list = (q ?? []).filter((x) => x.status === 'to_pay')
  if (!list.length) return null
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '5px solid var(--blue)', borderRadius: 0 }}>
      <h2 style={{ marginBottom: 10 }}>รอคิดเงิน ({list.length})</h2>
      <div className="row">
        {list.map((x) => (
          <button key={x.id} className="pet-chip" onClick={() => nav(`/pos?customer=${x.customer_id}&pet=${x.pet_id}&queue=${x.id}${x.visit_id ? `&visit=${x.visit_id}` : ''}${x.vet_id ? `&vet=${x.vet_id}` : ''}`)}>
            <b>คิว {x.queue_no} · {x.pet_name}</b>
            <span className="small muted">{x.owner_name} · {x.reason}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepCustomer(props: {
  customer: any
  petId: string
  onPick: (c: any) => void
  onPet: (id: string) => void
  onWalkIn: () => void
  onNext: () => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    if (!q.trim()) return setRows([])
    const t = setTimeout(() => api('customers.search', { q, limit: 10 }).then(setRows), 150)
    return () => clearTimeout(t)
  }, [q])
  const pick = async (id: string): Promise<void> => {
    props.onPick(await api('customers.get', { id }))
    setQ('')
  }
  const c = props.customer
  return (
    <div className="grid g2">
      <div className="card stack">
        <h2>ลูกค้าคือใคร?</h2>
        <div className="bigsearch">
          <Search />
          <input autoFocus placeholder="พิมพ์ชื่อ เบอร์โทร หรือชื่อสัตว์" value={q} onChange={(e) => setQ(e.target.value)} />
          {rows.length > 0 && (
            <div className="results">
              {rows.map((r) => (
                <div key={r.id} className="result" style={{ cursor: 'pointer' }} onClick={() => pick(r.id)}>
                  <div className="avatar">{initial(r.name)}</div>
                  <div className="who">
                    <b>{r.name}</b> <span className="muted">{r.phone}</span>
                    {r.pet_names && <div className="small muted">สัตว์: {r.pet_names}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid g2">
          <button className="action" onClick={() => setCreating(true)}>
            <div className="ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><UserPlus size={26} /></div>
            <div><b>ลูกค้าใหม่</b><span>ลงทะเบียนก่อนขาย</span></div>
          </button>
          <button className="action" onClick={props.onWalkIn}>
            <div className="ico" style={{ background: '#eef1f4', color: '#5a6b7c' }}><User size={26} /></div>
            <div><b>ลูกค้าทั่วไป</b><span>ซื้อของ ไม่ต้องเก็บชื่อ</span></div>
          </button>
        </div>
      </div>
      <div className="card stack">
        {!c ? (
          <Empty icon={<User />} text="ยังไม่ได้เลือกลูกค้า" />
        ) : (
          <>
            <div className="row">
              <div className="avatar lg">{initial(c.name)}</div>
              <div className="grow">
                <h2>{c.name}</h2>
                <div className="muted">{c.phone}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  {c.outstanding > 0 && <span className="badge bad">ค้างชำระเดิม {money(c.outstanding)}</span>}
                  {c.deposit_balance > 0 && <span className="badge ok">มีเงินมัดจำ {money(c.deposit_balance)}</span>}
                </div>
              </div>
            </div>
            <b>มาวันนี้กับตัวไหน?</b>
            <div className="row">
              {c.pets.map((p: any) => (
                <button key={p.id} className={`pet-chip ${props.petId === p.id ? 'active' : ''}`} onClick={() => props.onPet(props.petId === p.id ? '' : p.id)}>
                  <b>{p.name}</b>
                  <span className="small muted">{p.species}{p.breed && ` · ${p.breed}`}</span>
                  {(p.allergy_note || p.warning_note) && <span className="tiny" style={{ color: 'var(--bad)' }}>⚠ {p.allergy_note ? `แพ้ ${p.allergy_note}` : p.warning_note}</span>}
                </button>
              ))}
              {c.pets.length === 0 && <span className="muted">ไม่มีสัตว์เลี้ยง (ขายสินค้าได้ตามปกติ)</span>}
            </div>
            <button className="big block" onClick={props.onNext}>ถัดไป: เลือกรายการ <ArrowRight /></button>
          </>
        )}
      </div>
      {creating && <CustomerForm initial={{ name: q }} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); pick(id) }} />}
    </div>
  )
}

export function StepPay(props: {
  total: number
  customer: any
  needsApproval: boolean
  discountPct: number
  canPay: boolean
  onBack: () => void
  onSubmit: (payments: { method: string; amount: number }[], approval?: any) => Promise<any>
}) {
  const depositBal = props.customer?.deposit_balance ?? 0
  const methods = ['cash', 'transfer', 'promptpay', 'card', ...(depositBal > 0 ? ['deposit'] : [])]
  const [amounts, setAmounts] = useState<Record<string, string>>({ cash: String(props.total) })
  const [tendered, setTendered] = useState('')
  const [allowUnpaid, setAllowUnpaid] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [askApproval, setAskApproval] = useState(false)
  const [busy, setBusy] = useState(false)
  const [split, setSplit] = useState(false)

  const num = (m: string): number => Number(amounts[m]) || 0
  const used = Object.keys(amounts)
  const paid = r2(used.reduce((t, m) => t + num(m), 0))
  const remaining = r2(props.total - paid)
  const change = Math.max((Number(tendered) || 0) - num('cash'), 0)

  const toggle = (m: string): void =>
    setAmounts((a) => {
      if (!split) return { [m]: String(m === "deposit" ? Math.min(props.total, depositBal) : props.total) }
      if (m in a) {
        const { [m]: _, ...rest } = a
        return rest
      }
      const left = Math.max(r2(props.total - Object.keys(a).reduce((t, k) => t + (Number(a[k]) || 0), 0)), 0)
      return { ...a, [m]: String(m === 'deposit' ? Math.min(left, depositBal) : left) }
    })

  useEffect(() => {
    const amt = num('promptpay')
    if (amt <= 0) return setQr(null)
    api<string | null>('promptpay.qr', { amount: amt }).then(setQr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts.promptpay])

  const ok = props.canPay && remaining >= 0 && (remaining === 0 || (allowUnpaid && !!props.customer))
  const submit = async (approval?: any): Promise<void> => {
    if (props.needsApproval && !approval) return setAskApproval(true)
    setBusy(true)
    const res = await props.onSubmit(used.map((m) => ({ method: m, amount: num(m) })).filter((p) => p.amount > 0), approval)
    setBusy(false)
    if (!res) setAskApproval(false)
  }

  return (
    <div className="card stack">
      <div className="row">
        <button className="secondary" onClick={props.onBack}><ArrowLeft /> แก้ไขรายการ</button>
        <div className="grow" />
        <div className="right">
          <div className="muted">ยอดที่ต้องชำระ</div>
          <div className="head-font" style={{ fontSize: 40, lineHeight: 1 }}>{money(props.total)}</div>
        </div>
      </div>
      <div className="row">
        <b className="grow">ลูกค้าจ่ายด้วยอะไร?</b>
        <label className="check small"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> แบ่งจ่ายหลายช่องทาง</label>
      </div>
      <div className="methods" style={{ gridTemplateColumns: `repeat(${methods.length}, 1fr)` }}>
        {methods.map((m) => {
          const Icon = METHOD_ICON[m]
          return (
            <button key={m} className={`method ${m in amounts ? 'active' : ''}`} onClick={() => toggle(m)}>
              <Icon /> {METHOD_LABEL[m]}
              {m === 'deposit' && <span className="tiny muted">มี {money(depositBal)}</span>}
            </button>
          )
        })}
      </div>
      {(split || used.length > 1) && used.map((m) => (
        <div key={m} className="pay-line">
          <b>{METHOD_LABEL[m]}</b>
          <input className="big" type="number" min="0" value={amounts[m]} onChange={(e) => setAmounts((a) => ({ ...a, [m]: e.target.value }))} />
          <button className="ghost" style={{ color: 'var(--bad)' }} aria-label="เอาออก" onClick={() => toggle(m)}><Trash2 /></button>
        </div>
      ))}
      {num('cash') > 0 && (
        <div className="pick">
          <div className="pay-line">
            <span>รับเงินสดมา</span>
            <input className="big" type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={money(num('cash'))} />
            <span />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {[num('cash'), 100, 500, 1000].filter((v, i, a) => a.indexOf(v) === i && v >= num('cash')).map((b, i) => (
              <button key={b} className="chip" onClick={() => setTendered(String(i === 0 ? b : Math.ceil(num('cash') / b) * b))}>
                {i === 0 ? 'พอดี' : money(Math.ceil(num('cash') / b) * b)}
              </button>
            ))}
            <div className="grow" />
            <span style={{ fontSize: 22 }}>เงินทอน <b className="head-font" style={{ color: 'var(--ok)', fontSize: 28 }}>{money(change)}</b></span>
          </div>
        </div>
      )}
      {num('promptpay') > 0 && (
        <div className="center pick">
          {qr ? (
            <>
              <img src={qr} width={230} height={230} alt="PromptPay QR" />
              <div className="small muted">ให้ลูกค้าสแกนจ่าย {money(num('promptpay'))} บาท — ตรวจยอดเข้าก่อนกดยืนยัน</div>
            </>
          ) : (
            <div className="alert warn small">ยังไม่ได้ตั้งเลขพร้อมเพย์ของร้าน (ตั้งค่า → ข้อมูลร้าน)</div>
          )}
        </div>
      )}
      <div className={`alert ${remaining === 0 ? 'ok' : remaining < 0 ? '' : 'warn'}`}>
        {remaining === 0 && <><Check size={18} /> ชำระครบแล้ว</>}
        {remaining < 0 && `ยอดชำระเกิน ${money(-remaining)} บาท — ถ้าเป็นเงินสดให้ใส่ช่อง "รับเงินสดมา" แทน`}
        {remaining > 0 && `ยังขาดอีก ${money(remaining)} บาท`}
      </div>
      {remaining > 0 &&
        (props.customer ? (
          <label className="check">
            <input type="checkbox" checked={allowUnpaid} onChange={(e) => setAllowUnpaid(e.target.checked)} />
            ลูกค้าขอค้างไว้ก่อน — บันทึกส่วนที่เหลือเป็น <b>ค้างชำระ</b>
          </label>
        ) : (
          <div className="small muted">ลูกค้าทั่วไปต้องจ่ายเต็มจำนวน (ค้างชำระได้เฉพาะลูกค้าที่มีชื่อในระบบ)</div>
        ))}
      {!props.canPay && <div className="alert">ต้องเปิดกะก่อนรับเงิน</div>}
      <button className="big block ok" disabled={!ok || busy} onClick={() => submit()}>
        <Check /> ยืนยันรับเงิน และพิมพ์ใบเสร็จ
      </button>
      {askApproval && (
        <ApprovalModal title="ขออนุมัติส่วนลด" reason={`ส่วนลดรวม ${props.discountPct}% เกินสิทธิ์ของคุณ`} onClose={() => setAskApproval(false)} onApprove={(a) => submit(a)} />
      )}
    </div>
  )
}
