import { NavLink, useParams } from 'react-router-dom'
import { BarChart3, Receipt, Clock3, Banknote } from 'lucide-react'
import { useApi, useSession } from '../ui'
import Reports from './Reports'
import Invoices from './Invoices'
import Shift from './Shift'

/** การเงิน tab: overview, all bills, outstanding bills and the cash drawer in one place. */
export default function Finance() {
  const { can } = useSession()
  const [d] = useApi<any>('reports.dashboard')
  const tab = useParams().tab ?? (can('reports') ? 'overview' : 'bills')
  const tabs = [
    ...(can('reports') ? [{ key: 'overview', label: 'ภาพรวม/รายงาน', icon: BarChart3 }] : []),
    { key: 'bills', label: 'บิลทั้งหมด', icon: Receipt },
    { key: 'outstanding', label: 'ค้างชำระ', icon: Clock3, count: d?.outstanding_count },
    { key: 'shift', label: 'กะ/ลิ้นชักเงิน', icon: Banknote }
  ]
  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>การเงิน</h1>
          <div className="lead">ยอดขาย บิล ลูกค้าค้างชำระ และการเปิด/ปิดกะ</div>
        </div>
      </div>
      <div className="subtabs">
        {tabs.map((t) => (
          <NavLink key={t.key} to={`/finance/${t.key}`} className={tab === t.key ? 'active' : ''}>
            <t.icon size={17} /> {t.label} {t.count ? <span className="count">{t.count}</span> : null}
          </NavLink>
        ))}
      </div>
      {tab === 'overview' && can('reports') && <Reports />}
      {tab === 'bills' && <Invoices key="bills" />}
      {tab === 'outstanding' && <Invoices key="outstanding" preset="outstanding" />}
      {tab === 'shift' && <Shift />}
    </>
  )
}
