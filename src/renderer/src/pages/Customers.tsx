import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, Phone, Users } from 'lucide-react'
import { api, money, thDate } from '../api'
import { Empty, initial } from '../ui'
import { CustomerForm } from './forms'

export default function Customers() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [rows, setRows] = useState<any[]>([])
  const [creating, setCreating] = useState(params.get('new') === '1')

  useEffect(() => {
    const t = setTimeout(() => api('customers.search', { q, limit: 200 }).then(setRows), 200)
    return () => clearTimeout(t)
  }, [q])

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>ลูกค้า & สัตว์เลี้ยง</h1>
          <div className="lead">ทั้งหมด {rows.length} ราย · กดที่รายชื่อเพื่อดูประวัติ</div>
        </div>
        <button className="big" onClick={() => setCreating(true)}><UserPlus /> ลูกค้าใหม่</button>
      </div>
      <div className="bigsearch" style={{ marginBottom: 16 }}>
        <Search />
        <input autoFocus placeholder="ค้นหาจากชื่อเจ้าของ เบอร์โทร ชื่อสัตว์ หรือรหัสลูกค้า" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <Empty icon={<Users />} text={q ? `ไม่พบ "${q}"` : 'ยังไม่มีลูกค้า — กด "ลูกค้าใหม่" เพื่อเริ่ม'} />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}></th>
                <th>ลูกค้า</th>
                <th>โทร</th>
                <th>สัตว์เลี้ยง</th>
                <th>มาล่าสุด</th>
                <th className="num">ค้างชำระ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/customers/${r.id}`)}>
                  <td><div className="avatar">{initial(r.name)}</div></td>
                  <td>
                    <div className="bold">{r.name}</div>
                    <div className="tiny muted">{r.code}</div>
                  </td>
                  <td>{r.phone ? <span className="row" style={{ gap: 4 }}><Phone size={14} /> {r.phone}</span> : '-'}</td>
                  <td>{r.pet_names ?? <span className="muted">-</span>}</td>
                  <td className="muted small">{thDate(r.updated_at)}</td>
                  <td className="num">{r.outstanding > 0 ? <span className="badge bad">{money(r.outstanding)}</span> : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && (
        <CustomerForm
          initial={{ name: /^\d/.test(q) ? '' : q, phone: /^\d/.test(q) ? q : '' }}
          onClose={() => { setCreating(false); setParams({}) }}
          onSaved={(id) => nav(`/customers/${id}?newpet=1`)}
        />
      )}
    </>
  )
}
