declare global {
  interface Window {
    rimping: {
      call: (method: string, args?: unknown) => Promise<{ ok: boolean; data?: any; error?: string }>
      openPrint: (route: string) => Promise<void>
    }
  }
}

export async function api<T = any>(method: string, args?: unknown): Promise<T> {
  const res = await window.rimping.call(method, args)
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

export const openPrint = (route: string): Promise<void> => window.rimping.openPrint(route)

/* ---------- formatting ---------- */

const moneyFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (n: number | null | undefined): string => moneyFmt.format(Number(n) || 0)

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** "2026-10-18" or "2026-10-18 14:05:00" → "18 ต.ค. 69" (Buddhist era). */
export function thDate(s?: string | null, withTime = false): string {
  if (!s) return '-'
  const [d, t] = s.split(/[ T]/)
  const [y, m, day] = d.split('-').map(Number)
  if (!y) return s
  const out = `${day} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`
  return withTime && t ? `${out} ${t.slice(0, 5)}` : out
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthStart(): string {
  return todayStr().slice(0, 8) + '01'
}

export function age(birth?: string | null): string {
  if (!birth) return '-'
  const b = new Date(birth + 'T00:00:00')
  const n = new Date()
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
  if (n.getDate() < b.getDate()) months--
  if (months < 0) return '-'
  const y = Math.floor(months / 12)
  const m = months % 12
  return y ? `${y} ปี${m ? ` ${m} เดือน` : ''}` : `${m} เดือน`
}

export const CATEGORY_LABEL: Record<string, string> = {
  service: 'ค่าบริการ/ค่าตรวจ',
  procedure: 'หัตถการ',
  vaccine: 'วัคซีน',
  medicine: 'ยา',
  food: 'อาหาร',
  supply: 'เวชภัณฑ์/อุปกรณ์',
  other: 'อื่น ๆ'
}

export const METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  promptpay: 'QR พร้อมเพย์',
  deposit: 'หักเงินมัดจำ'
}

export const STATUS_LABEL: Record<string, string> = {
  paid: 'ชำระแล้ว',
  partial: 'ชำระบางส่วน',
  unpaid: 'ค้างชำระ',
  void: 'ยกเลิก'
}

export const SEX_LABEL: Record<string, string> = { M: 'ผู้', F: 'เมีย', U: 'ไม่ระบุ' }

export const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของร้าน',
  manager: 'ผู้จัดการร้าน',
  vet: 'สัตวแพทย์',
  staff: 'พนักงานหน้าร้าน'
}

export const SPECIES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'หนูแฮมสเตอร์', 'กระรอก', 'เต่า', 'อื่น ๆ']
