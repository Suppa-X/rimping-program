import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Wallet, Receipt, Search, AlertTriangle, BedDouble, Stethoscope, X } from 'lucide-react'
import { api, money, thDate, todayStr, openPrint, CATEGORY_LABEL, METHOD_LABEL } from '../api'
import { useApi, useAction, useSession, Modal, Field, Empty, SpeciesIcon } from '../ui'
import { StepPay, draftReceipt } from './Pos'

export default function AdmissionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const act = useAction()
  const { me, shift, refreshShift } = useSession()
  const [ad, reload] = useApi<any>('admissions.get', { id }, [id])
  const [products] = useApi<any[]>('products.list', {})
  const [vets] = useApi<any[]>('users.vets')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [date, setDate] = useState(todayStr())
  const [pick, setPick] = useState<any>(null)
  const [paying, setPaying] = useState(false)
  const [deposit, setDeposit] = useState(false)
  const [billDiscount, setBillDiscount] = useState('')
  const [preview, setPreview] = useState<any>(null)

  const live = ad?.status === 'admitted'
  const charges = (ad?.charges ?? []) as any[]
  const active = charges.filter((c) => !c.voided)
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const c of charges) m.set(c.charge_date, [...(m.get(c.charge_date) ?? []), c])
    return [...m.entries()]
  }, [charges])

  useEffect(() => {
    if (!paying || !active.length) return
    api('pos.preview', {
      items: active.map((c) => ({ product_id: c.product_id, qty: c.qty, unit_price: c.unit_price, discount: c.discount })),
      bill_discount: Number(billDiscount) || 0
    }).then(setPreview)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paying, billDiscount, ad])

  if (!ad) return null
  const shown = (products ?? []).filter(
    (p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase() === q.toLowerCase())
  )
  const quick = (products ?? []).filter((p) => p.category === 'boarding')

  return (
    <>
      <a className="back" onClick={() => nav('/admissions')}><ArrowLeft size={16} /> รายชื่อ Admit</a>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="profile">
          <SpeciesIcon species={ad.species} size={30} />
          <div className="info">
            <div className="row" style={{ gap: 8 }}>
              <h1>{ad.pet_name}</h1>
              <span className="muted">{ad.pet_code}</span>
              <span className={`badge ${ad.kind === 'boarding' ? 'warn' : 'purple'}`}>{ad.kind === 'boarding' ? 'ฝากเลี้ยง' : 'Admit รักษา'}</span>
              {!live && <span className="badge grey">{ad.status === 'discharged' ? 'รับกลับแล้ว' : 'ยกเลิก'}</span>}
            </div>
            <div className="chips-line">
              <span>{ad.admit_no}</span>
              <span>เจ้าของ <a onClick={() => nav(`/customers/${ad.customer_id}`)}>{ad.owner_name}</a> {ad.phone}</span>
              <span><BedDouble size={16} /> {ad.cage ? `กรง ${ad.cage}` : 'ไม่ระบุกรง'}</span>
              <span>รับเข้า {thDate(ad.admitted_at, true)} · วันที่ {ad.days}</span>
              {ad.vet_name && <span><Stethoscope size={16} /> {ad.vet_name}</span>}
            </div>
            {ad.reason && <div className="small" style={{ marginTop: 4 }}>{ad.reason}</div>}
          </div>
          <div className="stack" style={{ alignItems: 'stretch', minWidth: 240 }}>
            <div className="right">
              <div className="muted small">ค่าใช้จ่ายสะสม</div>
              <div className="head-font" style={{ fontSize: 32, color: 'var(--navy)' }}>{money(ad.total)}</div>
              {ad.deposit_balance > 0 && <div className="small" style={{ color: 'var(--ok)' }}>มัดจำคงเหลือ {money(ad.deposit_balance)}</div>}
            </div>
            {live ? (
              <>
                <button className="big ok" disabled={!active.length} onClick={() => setPaying(true)}><Receipt /> คิดเงิน & รับกลับ</button>
                <button className="secondary" onClick={() => setDeposit(true)}><Wallet /> รับมัดจำเพิ่ม</button>
              </>
            ) : (
              ad.invoice_id && <button className="secondary" onClick={() => nav(`/invoices/${ad.invoice_id}`)}><Receipt /> บิล {ad.invoice_no}</button>
            )}
          </div>
        </div>
        {(ad.allergy_note || ad.warning_note) && (
          <div className="alert" style={{ marginTop: 12 }}><AlertTriangle size={18} /> {ad.allergy_note && <b>แพ้: {ad.allergy_note}</b>} {ad.warning_note}</div>
        )}
      </div>

      <div className="split" style={{ gridTemplateColumns: live ? 'minmax(0,1fr) 460px' : '1fr' }}>
        <div className="card">
          <div className="card-head"><h2 className="grow">ค่าใช้จ่ายรายวัน</h2></div>
          {charges.length === 0 ? (
            <Empty text="ยังไม่มีค่าใช้จ่าย — เลือกรายการทางขวาเพื่อลง" />
          ) : (
            byDay.map(([day, list]) => (
              <div key={day} style={{ marginBottom: 14 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <b className="head-font">{thDate(day)}</b>
                  <span className="muted small">รวม {money(list.filter((c) => !c.voided).reduce((t, c) => t + c.qty * c.unit_price - c.discount, 0))}</span>
                </div>
                <div className="table-wrap"><table>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id} className={c.voided ? 'void' : ''}>
                        <td>{c.name} {c.note && <div className="tiny muted">{c.note}</div>}</td>
                        <td className="small muted">{CATEGORY_LABEL[c.category]}</td>
                        <td className="num">{c.qty} {c.unit}</td>
                        <td className="num">{money(c.unit_price)}</td>
                        <td className="num bold">{money(c.qty * c.unit_price - c.discount)}</td>
                        <td className="small muted">{c.vet_name ?? c.created_by_name}</td>
                        <td className="right">
                          {live && !c.voided && (
                            <button className="ghost" style={{ color: 'var(--bad)' }} aria-label="ยกเลิกรายการ"
                              onClick={async () => {
                                const reason = window.prompt(`ยกเลิก "${c.name}" — เหตุผล:`) ?? ''
                                if (reason && (await act(() => api('admissions.voidCharge', { id: c.id, reason }), 'ยกเลิกรายการแล้ว'))) reload()
                              }}>
                              <Trash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            ))
          )}
          {live && active.length === 0 && (
            <button className="ghost" style={{ color: 'var(--muted)' }}
              onClick={async () => {
                const reason = window.prompt('ยกเลิก Admit — เหตุผล:') ?? ''
                if (reason && (await act(() => api('admissions.cancel', { id: ad.id, reason }), 'ยกเลิก Admit แล้ว'))) nav('/admissions')
              }}>
              <X /> ยกเลิก Admit (ไม่มีค่าใช้จ่าย)
            </button>
          )}
        </div>

        {live && (
          <div className="card cart">
            <div className="card-head">
              <h2 className="grow"><Plus /> ลงค่าใช้จ่าย</h2>
              <input type="date" style={{ width: 160 }} value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </div>
            {quick.length > 0 && (
              <div className="chips" style={{ marginBottom: 10 }}>
                {quick.map((p) => (
                  <button key={p.id} className="chip" onClick={() => setPick(p)}>{p.name} · {money(p.price)}</button>
                ))}
              </div>
            )}
            <div className="bigsearch" style={{ marginBottom: 8 }}>
              <Search />
              <input placeholder="ค้นหายา / บริการ / สแกนบาร์โค้ด" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: 16, padding: '10px 12px 10px 52px' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && shown.length === 1) setPick(shown[0]) }} />
            </div>
            <div className="chips" style={{ marginBottom: 8 }}>
              {['', 'boarding', 'medicine', 'procedure', 'service', 'supply', 'food'].map((k) => (
                <button key={k} className={`chip ${cat === k ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setCat(k)}>{k ? CATEGORY_LABEL[k] : 'ทั้งหมด'}</button>
              ))}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {shown.map((p) => (
                <div key={p.id} className="result" style={{ cursor: 'pointer', padding: '8px 6px' }} onClick={() => setPick(p)}>
                  <div className="who">{p.name} <span className="tiny muted">{CATEGORY_LABEL[p.category]}</span></div>
                  <b className="num">{money(p.price)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pick && (
        <ChargeModal p={pick} vets={vets ?? []} defaultVet={ad.vet_id ?? (me.is_vet ? me.id : '')} date={date}
          onClose={() => setPick(null)}
          onSave={async (x) => {
            if (await act(() => api('admissions.addCharge', { admission_id: ad.id, product_id: pick.id, charge_date: date, ...x }), `ลง ${pick.name} แล้ว`)) {
              setPick(null)
              reload()
            }
          }} />
      )}
      {deposit && <QuickDeposit customerId={ad.customer_id} petName={ad.pet_name} onClose={() => setDeposit(false)} onDone={() => { setDeposit(false); reload(); refreshShift() }} />}
      {paying && preview && (
        <Modal wide title={`คิดเงิน Admit — ${ad.pet_name}`} onClose={() => setPaying(false)}>
          <div className="row">
            <span>ส่วนลดท้ายบิล (บาท)</span>
            <input type="number" style={{ width: 140 }} value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />
            <span className="muted small">ค่าใช้จ่ายรวม {money(preview.subtotal)} · {active.length} รายการ</span>
          </div>
          <StepPay
            key={preview.total}
            total={preview.total}
            customer={{ id: ad.customer_id, deposit_balance: ad.deposit_balance }}
            needsApproval={!!preview.needs_approval}
            discountPct={preview.discount_pct}
            canPay={!!shift}
            onBack={() => setPaying(false)}
            receipt={draftReceipt(preview, {
              customer: { name: ad.owner_name, phone: ad.phone },
              pet: { name: ad.pet_name, species: ad.species },
              by: me.display_name
            })}
            onSubmit={(payments, approval, print) =>
              act(async () => {
                const res = await api<any>('admissions.checkout', { id: ad.id, bill_discount: Number(billDiscount) || 0, payments, approval })
                refreshShift()
                if (print) openPrint(`/print/invoice/${res.id}`)
                setPaying(false)
                reload()
                return res
              }, 'คิดเงินและรับกลับแล้ว')
            }
          />
        </Modal>
      )}
    </>
  )
}

function ChargeModal(props: { p: any; vets: any[]; defaultVet: string; date: string; onClose: () => void; onSave: (x: any) => void }) {
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState(String(props.p.price))
  const [vet, setVet] = useState(props.p.needs_vet ? props.defaultVet : '')
  const [note, setNote] = useState('')
  return (
    <Modal
      title={`ลง ${props.p.name}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={() => props.onSave({ qty, unit_price: price, vet_id: vet || undefined, note })}>บันทึก</button>
        </>
      }
    >
      <div className="muted">วันที่ {thDate(props.date)}{props.p.track_stock ? ` · คงเหลือ ${props.p.stock_qty} ${props.p.unit}` : ''}</div>
      <div className="grid g2">
        <Field label={`จำนวน (${props.p.unit})`}>
          <input className="big" type="number" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="ราคาต่อหน่วย">
          <input className="big" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      {props.p.needs_vet ? (
        <Field label="สัตวแพทย์ผู้ทำ">
          <select value={vet} onChange={(e) => setVet(e.target.value)}>
            <option value="">— เลือก —</option>
            {props.vets.map((v) => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="หมายเหตุ">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช้า / เย็น" />
      </Field>
      <div className="alert info">รวม {money((Number(qty) || 0) * (Number(price) || 0))} บาท</div>
    </Modal>
  )
}

function QuickDeposit(props: { customerId: string; petName: string; onClose: () => void; onDone: () => void }) {
  const { shift } = useSession()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const act = useAction()
  return (
    <Modal
      title="รับเงินมัดจำ"
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!shift || !(Number(amount) > 0)}
            onClick={async () => (await act(() => api('deposits.add', { customer_id: props.customerId, amount, method, note: `มัดจำ Admit ${props.petName}` }), 'รับมัดจำแล้ว')) && props.onDone()}>
            บันทึก
          </button>
        </>
      }
    >
      {!shift && <div className="alert">ต้องเปิดกะก่อน</div>}
      <Field label="จำนวนเงิน (บาท)">
        <input className="big" type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <div className="chips">
        {['cash', 'transfer', 'promptpay', 'card'].map((m) => (
          <button key={m} className={`chip ${method === m ? 'active' : ''}`} onClick={() => setMethod(m)}>{METHOD_LABEL[m]}</button>
        ))}
      </div>
    </Modal>
  )
}
