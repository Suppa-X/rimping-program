import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PawPrint, Pencil, ShoppingBag, Plus, Phone, MessageCircle, MapPin, ShieldCheck, ShieldAlert, Wallet, Receipt, AlertTriangle, ListPlus } from 'lucide-react'
import { api, money, thDate, age, SEX_LABEL, METHOD_LABEL } from '../api'
import { useApi, useAction, useSession, Modal, Field, StatusBadge, Empty, SpeciesIcon, initial } from '../ui'
import { CustomerForm, PetForm } from './forms'

export default function CustomerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const act = useAction()
  const [params] = useSearchParams()
  const [c, reload] = useApi<any>('customers.get', { id }, [id])
  const [tab, setTab] = useState<'pets' | 'bills' | 'money'>('pets')
  const [editing, setEditing] = useState(false)
  const [addingPet, setAddingPet] = useState(params.get('newpet') === '1')
  const [deposit, setDeposit] = useState<'add' | 'refund' | null>(null)
  if (!c) return null

  const enqueue = async (p: any): Promise<void> => {
    if (await act(() => api('queue.add', { pet_id: p.id, reason: 'ตรวจรักษา' }), `${p.name} เข้าคิวแล้ว`)) nav('/exam')
  }

  return (
    <>
      <a className="back" onClick={() => nav('/customers')}><ArrowLeft size={16} /> ลูกค้าทั้งหมด</a>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="profile">
          <div className="avatar lg">{initial(c.name)}</div>
          <div className="info">
            <h1>{c.name}</h1>
            <div className="chips-line">
              <span className="muted">{c.code}</span>
              <span><Phone size={16} /> {c.phone || '-'} {c.phone2 && ` / ${c.phone2}`}</span>
              {c.line_id && <span><MessageCircle size={16} /> LINE: {c.line_id}</span>}
              {c.address && <span><MapPin size={16} /> {c.address}</span>}
              {c.pdpa_consent_at ? (
                <span style={{ color: 'var(--ok)' }}><ShieldCheck size={16} /> ยินยอม PDPA แล้ว</span>
              ) : (
                <span style={{ color: 'var(--warn)' }}><ShieldAlert size={16} /> ยังไม่ยินยอม PDPA</span>
              )}
            </div>
            {c.note && <div className="small muted" style={{ marginTop: 4 }}>หมายเหตุ: {c.note}</div>}
          </div>
          <div className="stack" style={{ alignItems: 'stretch' }}>
            <button className="big" onClick={() => nav(`/pos?customer=${c.id}`)}><ShoppingBag /> เปิดบิลขาย</button>
            <button className="secondary" onClick={() => setEditing(true)}><Pencil /> แก้ไขข้อมูล</button>
          </div>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="ico purple"><PawPrint /></div><div><div className="label">สัตว์เลี้ยง</div><div className="value">{c.pets.length} ตัว</div></div></div>
        <div className={`stat clickable`} onClick={() => setTab('bills')}>
          <div className={`ico ${c.outstanding > 0 ? 'bad' : 'ok'}`}><Receipt /></div>
          <div><div className="label">ยอดค้างชำระ</div><div className="value">{money(c.outstanding)}</div></div>
        </div>
        <div className="stat clickable" onClick={() => setTab('money')}>
          <div className="ico ok"><Wallet /></div>
          <div><div className="label">เงินมัดจำคงเหลือ</div><div className="value">{money(c.deposit_balance)}</div></div>
        </div>
      </div>

      <div className="subtabs">
        <button className={tab === 'pets' ? 'active' : ''} onClick={() => setTab('pets')}>สัตว์เลี้ยง ({c.pets.length})</button>
        <button className={tab === 'bills' ? 'active' : ''} onClick={() => setTab('bills')}>ประวัติบิล ({c.invoices.length})</button>
        <button className={tab === 'money' ? 'active' : ''} onClick={() => setTab('money')}>เงินมัดจำ</button>
      </div>

      {tab === 'pets' && (
        <div className="grid g2">
          {c.pets.map((p: any) => (
            <div key={p.id} className="pet-card" onClick={() => nav(`/pets/${p.id}`)}>
              <SpeciesIcon species={p.species} />
              <div className="grow">
                <div className="row" style={{ gap: 8 }}>
                  <h2>{p.name}</h2>
                  {p.deceased ? <span className="badge grey">เสียชีวิต</span> : null}
                </div>
                <div className="muted">
                  {p.species} {p.breed && `· ${p.breed}`} · {SEX_LABEL[p.sex]}{p.neutered ? ' (ทำหมัน)' : ''}
                </div>
                <div className="muted small">อายุ {age(p.birth_date)} {p.weight_kg ? `· ${p.weight_kg} กก.` : ''}</div>
                {(p.allergy_note || p.warning_note) && (
                  <div className="small" style={{ color: 'var(--bad)', marginTop: 4 }}>
                    <AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {[p.allergy_note && `แพ้ ${p.allergy_note}`, p.warning_note].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); enqueue(p) }}><ListPlus /> เข้าคิว</button>
            </div>
          ))}
          <button className="pet-card" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--blue)', borderStyle: 'dashed', fontSize: 17, minHeight: 100 }} onClick={() => setAddingPet(true)}>
            <Plus /> เพิ่มสัตว์เลี้ยง
          </button>
        </div>
      )}

      {tab === 'bills' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {c.invoices.length === 0 ? (
            <Empty icon={<Receipt />} text="ยังไม่มีบิล" />
          ) : (
            <table>
              <thead>
                <tr><th>เลขที่</th><th>วันที่</th><th>สัตว์</th><th className="num">ยอด</th><th className="num">ค้าง</th><th>สถานะ</th></tr>
              </thead>
              <tbody>
                {c.invoices.map((i: any) => (
                  <tr key={i.id} className={`clickable ${i.status === 'void' ? 'void' : ''}`} onClick={() => nav(`/invoices/${i.id}`)}>
                    <td>{i.invoice_no}</td>
                    <td>{thDate(i.issued_at, true)}</td>
                    <td>{i.pet_name ?? '-'}</td>
                    <td className="num">{money(i.total)}</td>
                    <td className="num">{i.status !== 'void' && i.total - i.paid_amount > 0 ? money(i.total - i.paid_amount) : '-'}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'money' && <DepositTab c={c} onAdd={() => setDeposit('add')} onRefund={() => setDeposit('refund')} />}

      {editing && <CustomerForm initial={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {addingPet && <PetForm customerId={c.id} onClose={() => setAddingPet(false)} onSaved={() => { setAddingPet(false); reload() }} />}
      {deposit && <DepositModal mode={deposit} customer={c} onClose={() => setDeposit(null)} onDone={() => { setDeposit(null); reload() }} />}
    </>
  )
}

function DepositTab({ c, onAdd, onRefund }: { c: any; onAdd: () => void; onRefund: () => void }) {
  const [rows] = useApi<any[]>('deposits.history', { customer_id: c.id }, [c.deposit_balance])
  const label = (r: any): string =>
    r.kind === 'deposit' ? 'รับมัดจำ' : r.kind === 'refund' && !r.invoice_id ? 'คืนเงินมัดจำ' : r.kind === 'refund' ? `คืนจากยกเลิกบิล ${r.invoice_no}` : `ใช้จ่ายบิล ${r.invoice_no}`
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="grow">เงินมัดจำคงเหลือ {money(c.deposit_balance)} บาท</h2>
        <button onClick={onAdd}><Plus /> รับเงินมัดจำ</button>
        {c.deposit_balance > 0 && <button className="secondary" onClick={onRefund}>คืนเงินมัดจำ</button>}
      </div>
      {!rows?.length ? (
        <Empty icon={<Wallet />} text="ยังไม่มีรายการมัดจำ — ใช้รับเงินล่วงหน้า เช่น ค่าผ่าตัด แล้วหักตอนคิดเงิน" />
      ) : (
        <table>
          <tbody>
            {rows.map((r) => {
              const plus = r.kind === 'deposit' || (r.kind === 'refund' && r.method === 'deposit')
              return (
                <tr key={r.id}>
                  <td className="nowrap">{thDate(r.paid_at, true)}</td>
                  <td>{label(r)} {r.note && <span className="muted small">· {r.note}</span>}</td>
                  <td className="muted small">{r.method !== 'deposit' ? METHOD_LABEL[r.method] : ''}</td>
                  <td className="num" style={{ color: plus ? 'var(--ok)' : 'var(--bad)' }}>{plus ? '+' : '-'}{money(r.amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function DepositModal(props: { mode: 'add' | 'refund'; customer: any; onClose: () => void; onDone: () => void }) {
  const { shift } = useSession()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const act = useAction()
  const add = props.mode === 'add'
  const save = async (): Promise<void> => {
    const ok = await act(
      () => api(add ? 'deposits.add' : 'deposits.refund', { customer_id: props.customer.id, amount, method, note }),
      add ? 'รับเงินมัดจำแล้ว' : 'คืนเงินมัดจำแล้ว'
    )
    if (ok) props.onDone()
  }
  return (
    <Modal
      title={add ? 'รับเงินมัดจำ' : 'คืนเงินมัดจำ'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!shift || !(Number(amount) > 0)} onClick={save}>บันทึก</button>
        </>
      }
    >
      {!shift && <div className="alert">ต้องเปิดกะก่อน (แท็บ การเงิน → กะ/ลิ้นชักเงิน)</div>}
      {!add && <div className="alert info">คงเหลือ {money(props.customer.deposit_balance)} บาท</div>}
      <Field label="จำนวนเงิน (บาท)" required>
        <input className="big" type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="ช่องทาง">
        <div className="chips">
          {['cash', 'transfer', 'promptpay'].map((m) => (
            <button key={m} className={`chip ${method === m ? 'active' : ''}`} onClick={() => setMethod(m)}>{METHOD_LABEL[m]}</button>
          ))}
        </div>
      </Field>
      <Field label="หมายเหตุ">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="มัดจำค่าผ่าตัด" />
      </Field>
    </Modal>
  )
}
