import { useNavigate } from 'react-router-dom'
import { HandCoins, CreditCard, Receipt, Search, ShoppingBag } from 'lucide-react'
import { money, thDate, STATUS_LABEL } from '../api'
import { useApi, Empty, Hint, SpeciesIcon } from '../ui'
import { SourceBadge, payUrl } from './Exam'

/** คิดเงิน: everyone waiting to pay after an exam, plus bills still owing. */
export default function Billing() {
  const nav = useNavigate()
  const [queue] = useApi<any[]>('queue.today')
  const [owing] = useApi<any[]>('invoices.list', { status: 'outstanding' })
  const toPay = (queue ?? []).filter((q) => q.status === 'to_pay')

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem emerald"><HandCoins /></span> คิดเงิน</h1>
          <div className="lead">ลูกค้าที่ตรวจเสร็จแล้วจะมารออยู่ที่นี่ กด "รับเงิน" แล้วเลือกรายการค่าตรวจ ยา และบริการ</div>
        </div>
        <button className="secondary" onClick={() => nav('/pos')}><Search /> คิดเงินลูกค้าคนอื่น</button>
        <button className="secondary" onClick={() => nav('/shop')}><ShoppingBag /> ขายหน้าร้าน</button>
      </div>

      <div className="card tinted emerald">
        <div className="card-head">
          <h2 className="grow"><CreditCard /> รอชำระเงินวันนี้ ({toPay.length})</h2>
        </div>
        {toPay.length === 0 && <Empty text="ยังไม่มีลูกค้ารอชำระเงิน" />}
        <div className="pay-grid">
          {toPay.map((q) => (
            <div key={q.id} className="pay-card">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <SpeciesIcon species={q.species} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pet">คิว {q.queue_no} · {q.pet_name}</div>
                  <div className="meta">{q.owner_name} · {q.phone}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <SourceBadge q={q} />
                {q.reason && <span className="badge">{q.reason}</span>}
                {q.vet_name && <span className="badge purple">{q.vet_name}</span>}
              </div>
              <button className="big ok block" onClick={() => nav(payUrl(q))}><CreditCard /> รับเงิน</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2 className="grow"><Receipt /> บิลค้างชำระ ({owing?.length ?? 0})</h2>
          <span className="muted small">กดที่บิลเพื่อรับชำระส่วนที่เหลือ</span>
        </div>
        {owing && owing.length === 0 && <Empty text="ไม่มีบิลค้างชำระ" />}
        {owing && owing.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>วันที่</th><th>เลขที่</th><th>ลูกค้า</th><th className="num">ยอดบิล</th><th className="num">ค้าง</th><th>สถานะ</th></tr>
              </thead>
              <tbody>
                {owing.map((i) => (
                  <tr key={i.id} className="clickable" onClick={() => nav(`/invoices/${i.id}`)}>
                    <td>{thDate(i.issued_at)}</td>
                    <td>{i.invoice_no}</td>
                    <td>{i.customer_name}{i.pet_name && <span className="muted"> · {i.pet_name}</span>}</td>
                    <td className="num">{money(i.total)}</td>
                    <td className="num bold" style={{ color: 'var(--bad)' }}>{money(i.total - i.paid_amount)}</td>
                    <td><span className="badge bad">{STATUS_LABEL[i.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <Hint>ก่อนบันทึก โปรแกรมจะแสดง <b>ตัวอย่างใบเสร็จ</b> ให้ตรวจทุกครั้ง แล้วจึงกด "ยืนยันรับเงิน + พิมพ์"</Hint>
      </div>
    </>
  )
}
