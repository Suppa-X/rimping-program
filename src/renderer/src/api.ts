declare global {
  interface Window {
    rimping: {
      call: (method: string, args?: unknown) => Promise<{ ok: boolean; data?: any; error?: string }>
      openPrint: (route: string) => Promise<void>
    }
  }
}

/** True when running as the browser demo (no Electron preload). */
export const isWeb = typeof window !== "undefined" && !window.rimping

export async function api<T = any>(method: string, args?: unknown): Promise<T> {
  const res = isWeb
    ? await fetch("/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, args }) }).then((r) => r.json())
    : await window.rimping.call(method, args)
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

export const openPrint = async (route: string): Promise<void> => {
  if (isWeb) window.open(`#${route}`, '_blank', 'width=760,height=900')
  else await window.rimping.openPrint(route)
}

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
  grooming: 'อาบน้ำตัดขน',
  boarding: 'ฝากเลี้ยง/ค่าห้อง',
  other: 'อื่น ๆ'
}

export const METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  promptpay: 'QR พร้อมเพย์',
  card: 'บัตรเครดิต',
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
  owner: 'ผู้บริหาร (สิทธิ์เต็ม)',
  manager: 'ผู้จัดการร้าน',
  vet: 'สัตวแพทย์',
  staff: 'พนักงานหน้าร้าน'
}

export const SPECIES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'หนูแฮมสเตอร์', 'กระรอก', 'เต่า', 'อื่น ๆ']

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00")
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function addMonths(date: string, months: number): string {
  const d = new Date(date + "T00:00:00")
  d.setMonth(d.getMonth() + months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** "วันพุธที่ 15 ตุลาคม 2569" or "Wednesday, 15 October 2026". */
export function longDate(date: string, lang: "th" | "en" = "th"): string {
  const d = new Date(date + "T00:00:00")
  return lang === "th"
    ? `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`
    : `${EN_DAYS[d.getDay()]}, ${d.getDate()} ${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export const APPT_TOPICS = ["นัดวัคซีน", "ตรวจติดตามอาการ", "ฉีดยาต่อเนื่อง", "ตัดไหม/ทำแผล", "ผ่าตัด", "ทำหมัน", "ขูดหินปูน", "ถ่ายพยาธิ/หยดเห็บหมัด", "ตรวจเลือด", "อาบน้ำตัดขน", "อื่น ๆ"]

/* ---------- weekly closed days (setting "closed_weekdays", e.g. "2" = every Tuesday) ---------- */

export const parseClosed = (v?: string | null): number[] => (v ?? "").split(",").filter((x) => x !== "").map(Number)

export const isClosed = (date: string, closed: number[]): boolean => closed.includes(new Date(date + "T00:00:00").getDay())

/** The same date, or the next day the shop is open. */
export function openDay(date: string, closed: number[]): string {
  let d = date
  for (let i = 0; i < 7 && isClosed(d, closed); i++) d = addDays(d, 1)
  return d
}
