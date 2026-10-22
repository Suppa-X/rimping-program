import { useCallback, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Home as HomeIcon, PawPrint, ShoppingCart, Package, Wallet, Settings as SettingsIcon,
  LogOut, KeyRound, BedDouble, CalendarDays, LineChart, ChevronDown, CircleCheck, CircleAlert, Delete
} from 'lucide-react'
import logo from './assets/logo.png'
import { api, money, ROLE_LABEL, thDate, todayStr } from './api'
import { Me, SessionCtx, useAction, Field, initial } from './ui'
import Home from './pages/Home'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import PetDetail from './pages/PetDetail'
import Pos from './pages/Pos'
import InvoiceDetail from './pages/InvoiceDetail'
import Products from './pages/Products'
import Appointments from './pages/Appointments'
import Admissions from './pages/Admissions'
import AdmissionDetail from './pages/AdmissionDetail'
import PrintAppointment from './pages/PrintAppointment'
import PrintLabels from './pages/PrintLabels'
import Executive from './pages/Executive'
import Finance from './pages/Finance'
import Settings from './pages/Settings'
import PrintInvoice from './pages/PrintInvoice'

export default function App() {
  const location = useLocation()
  if (location.pathname.startsWith('/print/')) {
    return (
      <Routes>
        <Route path="/print/invoice/:id" element={<PrintInvoice />} />
        <Route path="/print/appointment/:id" element={<PrintAppointment />} />
        <Route path="/print/labels/:id" element={<PrintLabels />} />
      </Routes>
    )
  }
  return <Shell />
}

function Shell() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [shift, setShift] = useState<any>(null)
  const [counts, setCounts] = useState<any>({})
  const [menu, setMenu] = useState(false)
  const nav = useNavigate()
  const location = useLocation()

  const refreshShift = useCallback(async () => setShift(await api('shifts.current')), [])

  useEffect(() => {
    ;(async () => {
      setNeedsSetup(await api('auth.needsSetup'))
      setMe(await api('auth.me'))
    })()
  }, [])
  useEffect(() => {
    if (!me) return
    refreshShift()
    api('reports.dashboard').then(setCounts).catch(() => {})
  }, [me, refreshShift, location.pathname])

  if (me === undefined) return null
  if (needsSetup) return <SetupOwner onDone={() => setNeedsSetup(false)} />
  if (!me) return <Login onLogin={setMe} />

  const can = (p: string): boolean => me.perms.includes(p)
  const logout = async (): Promise<void> => {
    setMenu(false)
    await api('auth.logout')
    setMe(null)
    nav('/')
  }
  const tabs = [
    { to: '/', end: true, icon: HomeIcon, label: 'งานวันนี้', badge: counts.queue_waiting },
    { to: '/customers', icon: PawPrint, label: 'ลูกค้า & สัตว์' },
    { to: '/pos', icon: ShoppingCart, label: 'ขาย / คิดเงิน' },
    { to: '/appointments', icon: CalendarDays, label: 'นัดหมาย', badge: (counts.appt_today ?? 0) + (counts.vaccines_due ?? 0) },
    { to: '/admissions', icon: BedDouble, label: 'Admit/ฝากเลี้ยง', badge: counts.admitted },
    { to: '/products', icon: Package, label: 'คลังสินค้า', badge: counts.low_stock },
    { to: '/finance', icon: Wallet, label: 'การเงิน' },
    ...(me.perms.includes('reports') ? [{ to: '/executive', icon: LineChart, label: 'สรุปผู้บริหาร' }] : []),
    { to: '/settings', icon: SettingsIcon, label: 'ตั้งค่า' }
  ]

  return (
    <SessionCtx.Provider value={{ me, can, logout, shift, refreshShift }}>
      <div className="shell">
        <header className="topbar">
          <img className="logo" src={logo} alt="" />
          <div>
            <div className="name">ริมปิงสัตวแพทย์</div>
            <div className="sub">{thDate(todayStr())} · โปรแกรมผู้ช่วยหน้าร้าน</div>
          </div>
          <div className="grow" />
          {shift ? (
            <button className="pill on" onClick={() => nav('/finance/shift')}>
              <CircleCheck size={16} /> กะเปิดอยู่ · เงินในลิ้นชัก {money(shift.expected_cash)}
            </button>
          ) : (
            <button className="pill off" onClick={() => nav('/finance/shift')}>
              <CircleAlert size={16} /> ยังไม่เปิดกะ — กดเพื่อเปิด
            </button>
          )}
          <div className="userchip" onClick={() => setMenu((m) => !m)}>
            <div className="avatar">{initial(me.display_name)}</div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 600 }}>{me.display_name}</div>
              <div className="tiny" style={{ color: '#b9cde4' }}>{ROLE_LABEL[me.role]}</div>
            </div>
            <ChevronDown size={18} />
            {menu && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setMenu(false); nav('/settings?tab=me') }}><KeyRound /> เปลี่ยนรหัส PIN</button>
                <button onClick={logout}><LogOut /> ออกจากระบบ / สลับผู้ใช้</button>
              </div>
            )}
          </div>
        </header>
        <nav className="tabbar">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="tab">
              <t.icon />
              {t.label}
              {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="content" onClick={() => menu && setMenu(false)}>
          <div className="page">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/pets/:id" element={<PetDetail />} />
              <Route path="/pos" element={<Pos />} />
              <Route path="/vaccines" element={<Navigate to="/appointments?tab=vaccines" replace />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/admissions" element={<Admissions />} />
              <Route path="/admissions/:id" element={<AdmissionDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/finance/:tab" element={<Finance />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/executive" element={<Executive />} />
            </Routes>
          </div>
        </div>
      </div>
    </SessionCtx.Provider>
  )
}

function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [users, setUsers] = useState<{ username: string; display_name: string }[]>([])
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [demo, setDemo] = useState(false)
  const act = useAction()
  useEffect(() => {
    api<{ demo?: boolean }>('system.info').then((i) => setDemo(!!i?.demo))
    api('auth.usernames').then((u) => {
      setUsers(u)
      if (u.length === 1) setUsername(u[0].username)
    })
  }, [])
  const submit = async (p = pin): Promise<void> => {
    const m = await act(() => api<Me>('auth.login', { username, pin: p }))
    if (m) onLogin(m)
    else setPin('')
  }
  const press = (k: string): void => {
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    if (k === 'ok') return void submit()
    setPin((p) => (p.length < 8 ? p + k : p))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') press('ok')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="login">
      <div className="box">
        <img src={logo} alt="" />
        <h2 className="center">เลือกชื่อของคุณ แล้วกดรหัส PIN</h2>
        {demo && (
          <p className="muted center" style={{ margin: 0 }}>
            โหมดทดลอง — PIN: เจ้าของร้าน 1111 · ผู้จัดการ 2222 · พนักงาน 3333
          </p>
        )}
        <div className="userpick">
          {users.map((u) => (
            <button key={u.username} className={username === u.username ? 'active' : ''} onClick={() => { setUsername(u.username); setPin('') }}>
              <div className="avatar">{initial(u.display_name)}</div>
              <span style={{ whiteSpace: 'normal', fontSize: 14 }}>{u.display_name}</span>
            </button>
          ))}
        </div>
        {username && (
          <>
            <div className="pindots">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={i < pin.length ? 'on' : ''} />
              ))}
            </div>
            <div className="pinpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                <button key={k} onClick={() => press(k)}>{k}</button>
              ))}
              <button onClick={() => press('del')} aria-label="ลบ"><Delete /></button>
              <button onClick={() => press('0')}>0</button>
              <button className="ok" style={{ background: 'var(--ok)', color: '#fff' }} onClick={() => press('ok')}>เข้า</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SetupOwner({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ username: '', display_name: '', pin: '', pin2: '', is_vet: true })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x) => ({ ...x, [k]: v }))
  const submit = async (): Promise<void> => {
    if (f.pin !== f.pin2) return void act(() => Promise.reject(new Error('รหัส PIN ทั้งสองช่องไม่ตรงกัน')))
    const ok = await act(() => api('auth.setupOwner', f), 'สร้างบัญชีเจ้าของร้านแล้ว')
    if (ok) onDone()
  }
  return (
    <div className="login">
      <div className="box">
        <img src={logo} alt="" />
        <h1 className="center">ยินดีต้อนรับ</h1>
        <p className="muted center" style={{ margin: 0 }}>ตั้งค่าครั้งแรก — สร้างบัญชีเจ้าของร้าน (สิทธิ์สูงสุด)</p>
        <Field label="ชื่อที่แสดง" required>
          <input value={f.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="หมอสมชาย" />
        </Field>
        <Field label="ชื่อผู้ใช้ (ภาษาอังกฤษ)" required>
          <input value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="owner" />
        </Field>
        <div className="grid g2">
          <Field label="รหัส PIN (ตัวเลข 4–8 หลัก)" required>
            <input type="password" inputMode="numeric" value={f.pin} onChange={(e) => set('pin', e.target.value)} />
          </Field>
          <Field label="ยืนยันรหัส PIN" required>
            <input type="password" inputMode="numeric" value={f.pin2} onChange={(e) => set('pin2', e.target.value)} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.is_vet} onChange={(e) => set('is_vet', e.target.checked)} /> เป็นสัตวแพทย์ด้วย
        </label>
        <button className="big block" disabled={!f.username || !f.display_name || !f.pin} onClick={submit}>เริ่มใช้งาน</button>
      </div>
    </div>
  )
}
