import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, money, thDate, openPrint, METHOD_LABEL, CATEGORY_LABEL } from '../api'
import { useApi, useAction, useSession, Modal, Field, StatusBadge, ApprovalModal } from '../ui'

export default function InvoiceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [inv, reload] = useApi<any>('invoices.get', { id }, [id])
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)
  if (!inv) return null
  const due = Math.round((inv.total - inv.paid_amount) * 100) / 100

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <a onClick={() => nav(-1)}>← กลับ</a>
          <h1>
            บิล {inv.invoice_no} <StatusBadge status={inv.status} />
          </h1>
          <div className="muted">
            {thDate(inv.issued_at, true)} · ออกโดย {inv.created_by_name}
          </div>
        </div>
        <button className="secondary" onClick={() => openPrint(`/print/invoice/${inv.id}`)}>🖨️ พิมพ์ใบเสร็จ</button>
        {inv.items.some((it: any) => it.category === 'medicine') && <button className="secondary" onClick={() => openPrint(`/print/labels/${inv.id}`)}>💊 พิมพ์ฉลากยา</button>}
        {inv.status !== 'void' && due > 0 && <button className="ok" onClick={() => setPaying(true)}>💵 รับชำระยอดค้าง</button>}
        {inv.status !== 'void' && <button className="danger" onClick={() => setVoiding(true)}>ยกเลิกบิล</button>}
      </div>

      {inv.status === 'void' && (
        <div className="alert" style={{ marginBottom: 12 }}>
          ยกเลิกเมื่อ {thDate(inv.void_at, true)} โดย {inv.void_by_name} (อนุมัติโดย {inv.void_approved_by_name}) — เหตุผล: {inv.void_reason}
        </div>
      )}

      <div className="split">
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>รายการ</th>
                <th>หมวด</th>
                <th>แพทย์</th>
                <th className="num">จำนวน</th>
                <th className="num">ราคา/หน่วย</th>
                <th className="num">ส่วนลด</th>
                <th className="num">รวม</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it: any) => (
                <tr key={it.id}>
                  <td>{it.seq}</td>
                  <td>{it.name}</td>
                  <td className="muted small">{CATEGORY_LABEL[it.category]}</td>
                  <td className="small">{it.vet_name ?? '-'}</td>
                  <td className="num">{it.qty} {it.unit}</td>
                  <td className="num">{money(it.unit_price)}</td>
                  <td className="num">{it.discount ? money(it.discount) : '-'}</td>
                  <td className="num">{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="totals" style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 12 }}>
            <div><span>รวม</span><span className="num">{money(inv.subtotal)}</span></div>
            {inv.line_discount + inv.bill_discount > 0 && (
              <div><span>ส่วนลด</span><span className="num">-{money(inv.line_discount + inv.bill_discount)}</span></div>
            )}
            {inv.vat_enabled ? (
              <div className="muted small"><span>VAT {inv.vat_rate}%</span><span className="num">{money(inv.vat_amount)}</span></div>
            ) : null}
            <div className="grand"><span>ยอดสุทธิ</span><span className="num">{money(inv.total)}</span></div>
            <div><span>ชำระแล้ว</span><span className="num">{money(inv.paid_amount)}</span></div>
            {inv.status !== 'void' && due > 0 && (
              <div style={{ color: 'var(--bad)', fontWeight: 700 }}><span>ค้างชำระ</span><span className="num">{money(due)}</span></div>
            )}
          </div>
          {inv.note && <div className="muted" style={{ marginTop: 8 }}>หมายเหตุ: {inv.note}</div>}
          {inv.discount_approved_by_name && <div className="muted small">ส่วนลดอนุมัติโดย {inv.discount_approved_by_name}</div>}
        </div>

        <div>
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>ลูกค้า</h2>
            {inv.customer_id ? (
              <>
                <a onClick={() => nav(`/customers/${inv.customer_id}`)} className="bold">{inv.customer_name}</a>
                <div className="muted">{inv.customer_phone}</div>
                {inv.pet_id && <div>🐾 <a onClick={() => nav(`/pets/${inv.pet_id}`)}>{inv.pet_name}</a> ({inv.pet_species})</div>}
              </>
            ) : (
              <div className="muted">ลูกค้าทั่วไป</div>
            )}
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>การชำระเงิน</h2>
            {inv.payments.length === 0 ? (
              <div className="muted">ยังไม่มีการชำระ</div>
            ) : (
              <table>
                <tbody>
                  {inv.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="small">{thDate(p.paid_at, true)}</td>
                      <td>
                        {p.kind === 'refund' ? <span className="badge bad">คืนเงิน</span> : null} {METHOD_LABEL[p.method]}
                        <div className="muted small">{p.user_name}</div>
                      </td>
                      <td className="num" style={p.kind === 'refund' ? { color: 'var(--bad)' } : undefined}>
                        {p.kind === 'refund' ? '-' : ''}{money(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {paying && <PayDueModal inv={inv} due={due} onClose={() => setPaying(false)} onDone={() => { setPaying(false); reload() }} />}
      {voiding && <VoidModal inv={inv} onClose={() => setVoiding(false)} onDone={() => { setVoiding(false); reload() }} />}
    </>
  )
}

function PayDueModal(props: { inv: any; due: number; onClose: () => void; onDone: () => void }) {
  const { shift, refreshShift } = useSession()
  const [amount, setAmount] = useState(String(props.due))
  const [method, setMethod] = useState('cash')
  const act = useAction()
  const save = async (): Promise<void> => {
    const ok = await act(() => api('invoices.pay', { id: props.inv.id, payments: [{ method, amount }] }), 'รับชำระแล้ว')
    if (ok) {
      refreshShift()
      props.onDone()
    }
  }
  return (
    <Modal
      title={`รับชำระยอดค้าง ${props.inv.invoice_no}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button className="ok" disabled={!shift} onClick={save}>บันทึก</button>
        </>
      }
    >
      {!shift && <div className="alert">ต้องเปิดกะก่อน</div>}
      <div className="alert info">ยอดค้าง {money(props.due)} บาท</div>
      <Field label="ยอดที่รับ (รับบางส่วนได้)">
        <input className="big" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="ช่องทาง">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {['cash', 'transfer', 'promptpay', 'deposit'].map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
        </select>
      </Field>
    </Modal>
  )
}

function VoidModal(props: { inv: any; onClose: () => void; onDone: () => void }) {
  const { can, refreshShift } = useSession()
  const [reason, setReason] = useState('')
  const [askApproval, setAskApproval] = useState(false)
  const act = useAction()
  const submit = async (approval?: { username: string; pin: string }): Promise<void> => {
    if (!can('void') && !approval) return setAskApproval(true)
    const ok = await act(() => api('invoices.void', { id: props.inv.id, reason, approval }), 'ยกเลิกบิลแล้ว')
    if (ok) {
      refreshShift()
      props.onDone()
    } else setAskApproval(false)
  }
  return (
    <Modal
      title={`ยกเลิกบิล ${props.inv.invoice_no}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ไม่ยกเลิก</button>
          <button className="danger" disabled={!reason.trim()} onClick={() => submit()}>ยืนยันยกเลิกบิล</button>
        </>
      }
    >
      <div className="alert warn">
        เลขที่บิลจะยังอยู่ในระบบ (สถานะ "ยกเลิก") · คืนสต็อกสินค้า · บันทึกคืนเงิน {money(props.inv.paid_amount)} บาท ตามช่องทางที่รับมา
      </div>
      <Field label="เหตุผลการยกเลิก" required>
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น คิดราคาผิด, ลูกค้าเปลี่ยนใจ" />
      </Field>
      {askApproval && (
        <ApprovalModal
          title="ขออนุมัติยกเลิกบิล"
          reason="การยกเลิกบิลต้องให้ผู้จัดการหรือเจ้าของร้านอนุมัติ"
          onClose={() => setAskApproval(false)}
          onApprove={(a) => submit(a)}
        />
      )}
    </Modal>
  )
}
