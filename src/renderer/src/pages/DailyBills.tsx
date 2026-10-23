import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, ChevronLeft, ChevronRight, Printer, Receipt, Banknote, Clock3, Ban, Wallet } from 'lucide-react'
import logo from '../assets/logo.png'
import { api, money, thDate, todayStr, addDays, longDate, openPrint, METHOD_LABEL, STATUS_LABEL } from '../api'
import { useApi, Empty } from '../ui'

const METHODS = ['cash', 'transfer', 'promptpay', 'card', 'deposit']
const time = (s: string): string => s.slice(11, 16)

/** สรุปบิลประจำวัน: one day's bills, money received by method and cash expected in the drawer. */
export default function DailyBills() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? todayStr()
  const [d] = useApi<any>('reports.daily', { date }, [date])
  const go = (n: number): void => setParams({ date: addDays(date, n) })

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem indigo"><ClipboardList /></span> สรุปบิลประจำวัน</h1>
          <div className="lead">บิลทุกใบของวัน ยอดรับเงินแยกช่องทาง และเงินสดที่ควรมีในลิ้นชัก</div>
        </div>
        <button className="big" onClick={() => openPrint(`/print/daily/${date}`)}><Printer /> พิมพ์สรุป</button>
      </div>

      <div className="daybar">
        <button className="secondary" aria-label="วันก่อน" onClick={() => go(-1)}><ChevronLeft /></button>
        <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setParams({ date: e.target.value })} />
        <button className="secondary" aria-label="วันถัดไป" disabled={date >= todayStr()} onClick={() => go(1)}><ChevronRight /></button>
        <b className="head-font">{longDate(date)}</b>
        {date !== todayStr() && <button className="ghost" onClick={() => setParams({})}>วันนี้</button>}
      </div>

      {d && (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <div className="stat"><div className="ico"><Receipt /></div><div><div className="label">จำนวนบิล</div><div className="value">{d.bills}</div><div className="sub">ส่วนลดรวม {money(d.discount)}</div></div></div>
            <div className="stat"><div className="ico ok"><Banknote /></div><div><div className="label">ยอดขายสุทธิ</div><div className="value">{money(d.total)}</div><div className="sub">รับเงินจริง {money(d.received_total)}</div></div></div>
            <div className="stat"><div className={`ico ${d.unpaid ? 'bad' : ''}`}><Clock3 /></div><div><div className="label">ค้างชำระ (บิลวันนี้)</div><div className="value">{money(d.unpaid)}</div><div className="sub">ตามเก็บได้ที่หน้าคิดเงิน</div></div></div>
            <div className="stat"><div className={`ico ${d.void_count ? 'warn' : ''}`}><Ban /></div><div><div className="label">บิลที่ยกเลิก</div><div className="value">{d.void_count}</div><div className="sub">มูลค่า {money(d.void_total)}</div></div></div>
          </div>

          <div className="grid g2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-head"><span className="gem jade"><Wallet /></span><h2 className="grow">รับเงินแยกช่องทาง</h2></div>
              <div className="sumlist">
                {METHODS.map((m) => (
                  <div key={m}><span>{METHOD_LABEL[m]}</span><b>{money(d.received[m])}</b></div>
                ))}
                {d.deposits_in > 0 && <div><span>รับมัดจำล่วงหน้า</span><b>{money(d.deposits_in)}</b></div>}
                {d.refunds > 0 && <div className="bad"><span>คืนเงิน</span><b>-{money(d.refunds)}</b></div>}
                <div className="total"><span>เงินสดที่ควรมีในลิ้นชัก (ไม่รวมเงินทอนตั้งต้น)</span><b>{money(d.cash_in_drawer)}</b></div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h2 className="grow">ยอดขายแยกหมวด</h2></div>
              {d.by_category.length === 0 && <Empty text="ยังไม่มียอดขาย" />}
              <div className="sumlist">
                {d.by_category.map((c: any) => (
                  <div key={c.category}><span>{c.label}</span><b>{money(c.net)}</b></div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2 className="grow">บิลทั้งหมด ({d.list.length})</h2><span className="muted small">กดที่บิลเพื่อดูรายละเอียด</span></div>
            {d.list.length === 0 ? (
              <Empty text="ไม่มีบิลในวันนี้" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>เวลา</th><th>เลขที่</th><th>ลูกค้า</th><th>ชำระโดย</th><th className="num">ยอดบิล</th><th className="num">ค้าง</th><th>สถานะ</th></tr>
                  </thead>
                  <tbody>
                    {d.list.map((b: any) => (
                      <tr key={b.id} className={`clickable ${b.status === 'void' ? 'void' : ''}`} onClick={() => nav(`/invoices/${b.id}`)}>
                        <td>{time(b.issued_at)}</td>
                        <td>{b.invoice_no}</td>
                        <td>{b.customer_name ?? 'ลูกค้าทั่วไป'}{b.pet_name && <span className="muted"> · {b.pet_name}</span>}</td>
                        <td className="small">{b.methods.map((m: string) => METHOD_LABEL[m]).join(', ') || '-'}</td>
                        <td className="num">{money(b.total)}</td>
                        <td className="num">{b.status !== 'void' && b.total - b.paid_amount > 0 ? money(b.total - b.paid_amount) : ''}</td>
                        <td><span className={`badge ${b.status === 'paid' ? 'ok' : b.status === 'void' ? 'grey' : 'bad'}`}>{STATUS_LABEL[b.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** A5 print of the day's summary, to sign and keep with the cash at closing. */
export function PrintDaily() {
  const { date } = useParams()
  const [d, setD] = useState<any>(null)
  const [s, setS] = useState<any>(null)
  useEffect(() => {
    api('reports.daily', { date }).then(setD)
    api('settings.get').then(setS)
  }, [date])
  if (!d || !s) return null
  return (
    <>
      <div className="print-toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ (A5)</button>
        <button className="secondary" onClick={() => window.close()}>ปิด</button>
      </div>
      <div className="print-page">
        <div className="print-head">
          <img src={logo} alt="" />
          <div style={{ flex: 1 }}>
            <h1>{s.shop_name}</h1>
            <div>สรุปบิลประจำวัน {thDate(d.date)}</div>
          </div>
          <div className="right">พิมพ์เมื่อ {thDate(`${todayStr()} ${new Date().toTimeString().slice(0, 5)}`, true)}</div>
        </div>
        <table>
          <tbody>
            <tr><td>จำนวนบิล</td><td className="num">{d.bills} บิล</td></tr>
            <tr><td>ยอดขายสุทธิ</td><td className="num">{money(d.total)}</td></tr>
            <tr><td>ส่วนลดรวม</td><td className="num">{money(d.discount)}</td></tr>
            <tr><td>ค้างชำระ (บิลวันนี้)</td><td className="num">{money(d.unpaid)}</td></tr>
            <tr><td>บิลยกเลิก</td><td className="num">{d.void_count} บิล ({money(d.void_total)})</td></tr>
            {METHODS.map((m) => <tr key={m}><td>{METHOD_LABEL[m]}</td><td className="num">{money(d.received[m])}</td></tr>)}
            {d.deposits_in > 0 && <tr><td>รับมัดจำล่วงหน้า</td><td className="num">{money(d.deposits_in)}</td></tr>}
            {d.refunds > 0 && <tr><td>คืนเงิน</td><td className="num">-{money(d.refunds)}</td></tr>}
            <tr><td><b>เงินสดที่ควรมีในลิ้นชัก</b> (ไม่รวมเงินทอนตั้งต้น)</td><td className="num"><b>{money(d.cash_in_drawer)}</b></td></tr>
          </tbody>
        </table>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>เวลา</th><th>เลขที่</th><th>ลูกค้า</th><th className="num">ยอด</th><th>สถานะ</th></tr></thead>
          <tbody>
            {d.list.map((b: any) => (
              <tr key={b.id}>
                <td>{time(b.issued_at)}</td><td>{b.invoice_no}</td><td>{b.customer_name ?? 'ลูกค้าทั่วไป'}</td>
                <td className="num">{money(b.total)}</td><td>{STATUS_LABEL[b.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30 }}>
          <div className="center" style={{ width: 160 }}>......................................<div>ผู้นับเงิน</div></div>
          <div className="center" style={{ width: 160 }}>......................................<div>ผู้ตรวจ</div></div>
        </div>
      </div>
    </>
  )
}
