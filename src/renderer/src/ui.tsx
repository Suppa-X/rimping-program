import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { Cat, Dog, PawPrint, Inbox, X, Lightbulb, CalendarX2 } from 'lucide-react'
import { api, STATUS_LABEL, parseClosed, isClosed, openDay, longDate } from './api'

/* ---------- session ---------- */

export interface Me {
  id: string
  username: string
  display_name: string
  role: 'owner' | 'manager' | 'vet' | 'staff'
  max_discount_pct: number
  is_vet: number
  perms: string[]
}

interface Session {
  me: Me
  can: (perm: string) => boolean
  logout: () => void
  shift: any | null
  refreshShift: () => Promise<void>
}

export const SessionCtx = createContext<Session>(null as any)
export const useSession = (): Session => useContext(SessionCtx)

/* ---------- toast ---------- */

type Toast = { id: number; text: string; error?: boolean }
const ToastCtx = createContext<(text: string, error?: boolean) => void>(() => {})
export const useToast = (): ((text: string, error?: boolean) => void) => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, error }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), error ? 6000 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.error ? 'error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Load data from the API, with a reload function. */
export function useApi<T = any>(method: string, args?: any, deps: any[] = []): [T | undefined, () => void, boolean] {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const toast = useToast()
  useEffect(() => {
    let alive = true
    setLoading(true)
    api<T>(method, args)
      .then((d) => alive && setData(d))
      .catch((e) => toast(e.message, true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, tick, ...deps])
  return [data, () => setTick((t) => t + 1), loading]
}

/** Run an API action with toast feedback. Returns the result or undefined on error. */
export function useAction(): <T>(fn: () => Promise<T>, okText?: string) => Promise<T | undefined> {
  const toast = useToast()
  return useCallback(
    async (fn, okText) => {
      try {
        const r = await fn()
        if (okText) toast(okText)
        return r
      } catch (e: any) {
        toast(e.message, true)
        return undefined
      }
    },
    [toast]
  )
}

/* ---------- small components ---------- */

export function Modal(props: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className={`modal ${props.wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          <button className="ghost" aria-label="ปิด" onClick={props.onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>
  )
}

export function Field(props: { label: string; required?: boolean; children: ReactNode; style?: any }) {
  return (
    <label className="field" style={props.style}>
      <span className={props.required ? 'req' : ''}>{props.label}</span>
      {props.children}
    </label>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const cls = { paid: 'ok', partial: 'warn', unpaid: 'bad', void: 'grey' }[status] ?? ''
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status] ?? status}</span>
}

export function Empty({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <div>{text}</div>
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="hint">
      <Lightbulb />
      <div>{children}</div>
    </div>
  )
}

/** Coloured species avatar: dog / cat / anything else. */
export function SpeciesIcon({ species, size = 26 }: { species?: string; size?: number }) {
  const kind = species === "สุนัข" ? "dog" : species === "แมว" ? "cat" : "other"
  const Icon = kind === "dog" ? Dog : kind === "cat" ? Cat : PawPrint
  return (
    <div className={`species ${kind}`} style={{ width: size * 2, height: size * 2 }}>
      <Icon size={size} />
    </div>
  )
}

/** Asks a manager/owner to type their username + PIN to approve an action. */
export function ApprovalModal(props: {
  title: string
  reason: string
  onApprove: (a: { username: string; pin: string }) => void
  onClose: () => void
}) {
  const [users] = useApi<{ username: string; display_name: string }[]>('auth.usernames')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>
            ยกเลิก
          </button>
          <button disabled={!username || !pin} onClick={() => props.onApprove({ username, pin })}>
            อนุมัติ
          </button>
        </>
      }
    >
      <div className="alert warn">{props.reason}</div>
      <Field label="ผู้อนุมัติ" required>
        <select value={username} onChange={(e) => setUsername(e.target.value)}>
          <option value="">— เลือก —</option>
          {users?.map((u) => (
            <option key={u.username} value={u.username}>
              {u.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="รหัส PIN ผู้อนุมัติ" required>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && username && pin && props.onApprove({ username, pin })}
        />
      </Field>
    </Modal>
  )
}

/** First letter for an avatar, skipping the honorific "คุณ". */
export const initial = (name: string): string => (name.replace(/^คุณs*/, "") || name).slice(0, 1)

let closedCache: number[] | null = null

/** Weekdays the shop is closed (0 = Sunday), from settings (re-read each time a screen opens). */
export function useClosedDays(): number[] {
  const [closed, setClosed] = useState<number[]>(closedCache ?? [])
  useEffect(() => {
    api<any>('settings.get').then((s) => {
      closedCache = parseClosed(s.closed_weekdays)
      setClosed(closedCache)
    })
  }, [])
  return closed
}

/** Warning shown when a chosen date falls on the shop's day off, with a one-tap move to the next open day. */
export function ClosedDayWarning({ date, closed, onMove }: { date?: string; closed: number[]; onMove: (d: string) => void }) {
  if (!date || !isClosed(date, closed)) return null
  const next = openDay(date, closed)
  return (
    <div className="alert warn">
      <CalendarX2 size={18} /> {longDate(date)} ร้านหยุด
      <button className="orange" style={{ marginLeft: 'auto' }} onClick={() => onMove(next)}>เลื่อนเป็น{longDate(next).split('ที่')[0]}ที่ {Number(next.slice(8))}</button>
    </div>
  )
}
