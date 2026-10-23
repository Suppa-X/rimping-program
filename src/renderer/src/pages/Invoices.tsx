import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, money, thDate, todayStr } from '../api'
import { StatusBadge, Empty } from '../ui'

export default function Invoices({ preset }: { preset?: string }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const initialStatus = preset ?? params.get('status') ?? ''
  const [f, setF] = useState({
    from: initialStatus === 'outstanding' ? '' : todayStr(),
    to: initialStatus === 'outstanding' ? '' : todayStr(),
    status: initialStatus,
    q: ''
  })
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    const t = setTimeout(() => api('invoices.list', f).then(setRows), 150)
    return () => clearTimeout(t)
  }, [f])
  const set = (k: string, v: string): void => setF((x) => ({ ...x, [k]: v }))
  const live = rows.filter((r) => r.status !== 'void')
  const total = live.reduce((t, r) => t + r.total, 0)
  const due = live.reduce((t, r) => t + (r.total - r.paid_amount), 0)

  return (
    <>
      
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="date" style={{ width: 170 }} value={f.from} onChange={(e) => set('from', e.target.value)} />
          <span>ถึง</span>
          <input type="date" style={{ width: 170 }} value={f.to} onChange={(e) => set('to', e.target.value)} />
          <select style={{ width: 170 }} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="paid">ชำระแล้ว</option>
            <option value="outstanding">ค้างชำระ (ทั้งหมด)</option>
            <option value="void">ยกเลิก</option>
          </select>
          <input style={{ flex: 1, minWidth: 200 }} placeholder="🔍 เลขที่บิล / ชื่อลูกค้า / เบอร์" value={f.q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <div className="row muted small" style={{ marginBottom: 8 }}>
          {live.length} บิล · รวม <b>{money(total)}</b> บาท {due > 0 && <>· ค้างชำระ <b style={{ color: 'var(--bad)' }}>{money(due)}</b> บาท</>}
        </div>
        {rows.length === 0 ? (
          <Empty text="ไม่พบบิล" />
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>วันเวลา</th>
                <th>ลูกค้า</th>
                <th>สัตว์</th>
                <th className="num">ยอด</th>
                <th className="num">ค้าง</th>
                <th>สถานะ</th>
                <th>ผู้ออกบิล</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`clickable ${r.status === 'void' ? 'void' : ''}`} onClick={() => nav(`/invoices/${r.id}`)}>
                  <td>{r.invoice_no}</td>
                  <td className="nowrap">{thDate(r.issued_at, true)}</td>
                  <td>{r.customer_name ?? 'ลูกค้าทั่วไป'}</td>
                  <td>{r.pet_name ?? '-'}</td>
                  <td className="num">{money(r.total)}</td>
                  <td className="num">{r.status !== 'void' && r.total - r.paid_amount > 0 ? money(r.total - r.paid_amount) : '-'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="muted">{r.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  )
}
