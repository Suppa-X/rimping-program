import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { one, all, insert, update, uid, audit, tx } from './db'

export type Role = 'owner' | 'manager' | 'vet' | 'staff'

export interface SessionUser {
  id: string
  username: string
  display_name: string
  role: Role
  max_discount_pct: number
  is_vet: number
}

/** 'finance' = sales figures, the finance menu and executive numbers; front-desk staff work without it. */
export type Perm = 'settings' | 'void' | 'stock.edit' | 'reports' | 'finance' | 'emr.edit' | 'shift'

const ROLE_PERMS: Record<Role, Perm[]> = {
  owner: ['settings', 'void', 'stock.edit', 'reports', 'finance', 'emr.edit', 'shift'],
  manager: ['void', 'stock.edit', 'reports', 'finance', 'shift'],
  vet: ['reports', 'finance', 'emr.edit', 'shift'],
  staff: ['shift']
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'ผู้บริหาร (สิทธิ์เต็ม)',
  manager: 'ผู้จัดการร้าน',
  vet: 'สัตวแพทย์',
  staff: 'พนักงานหน้าร้าน'
}

let current: SessionUser | null = null

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

export function can(user: SessionUser | null, perm: Perm): boolean {
  return !!user && ROLE_PERMS[user.role].includes(perm)
}

export function requireUser(): SessionUser {
  if (!current) throw new Error('กรุณาเข้าสู่ระบบ')
  return current
}

export function requirePerm(perm: Perm): SessionUser {
  const u = requireUser()
  if (!can(u, perm)) throw new Error('คุณไม่มีสิทธิ์ทำรายการนี้')
  return u
}

function toSession(row: any): SessionUser {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    max_discount_pct: row.max_discount_pct,
    is_vet: row.is_vet
  }
}

function checkCredentials(username: string, pin: string): SessionUser | null {
  const row = one<any>('SELECT * FROM users WHERE username = ? AND active = 1', username.trim())
  if (!row || !verifyPin(pin, row.pin_hash)) return null
  return toSession(row)
}

/**
 * Verify another user's PIN to approve an action the current user may not do alone
 * (a discount above their limit, voiding a bill). Returns the approver.
 */
export function approve(
  username: string,
  pin: string,
  need: { perm?: Perm; discountPct?: number }
): SessionUser {
  const u = checkCredentials(username, pin)
  if (!u) throw new Error('ชื่อผู้ใช้หรือรหัส PIN ของผู้อนุมัติไม่ถูกต้อง')
  if (need.perm && !can(u, need.perm)) throw new Error(`${u.display_name} ไม่มีสิทธิ์อนุมัติรายการนี้`)
  if (need.discountPct !== undefined && u.role !== 'owner' && need.discountPct > u.max_discount_pct)
    throw new Error(`${u.display_name} อนุมัติส่วนลดได้ไม่เกิน ${u.max_discount_pct}%`)
  return u
}

export const authApi = {
  'auth.needsSetup': () => one<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n === 0,

  'auth.setupOwner': (a: { username: string; display_name: string; pin: string; is_vet: boolean }) => {
    if (one<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n > 0) throw new Error('ตั้งค่าเจ้าของร้านไปแล้ว')
    validatePin(a.pin)
    const id = uid()
    insert('users', {
      id,
      username: a.username.trim(),
      display_name: a.display_name.trim(),
      role: 'owner',
      pin_hash: hashPin(a.pin),
      max_discount_pct: 100,
      is_vet: a.is_vet
    })
    audit(id, 'user.setup_owner', 'users', id)
    return true
  },

  'auth.usernames': () =>
    all<{ username: string; display_name: string }>(
      'SELECT username, display_name FROM users WHERE active = 1 ORDER BY display_name'
    ),

  'auth.login': (a: { username: string; pin: string }) => {
    const u = checkCredentials(a.username, a.pin)
    if (!u) throw new Error('ชื่อผู้ใช้หรือรหัส PIN ไม่ถูกต้อง')
    current = u
    audit(u.id, 'auth.login')
    return { ...u, perms: ROLE_PERMS[u.role] }
  },

  'auth.logout': () => {
    if (current) audit(current.id, 'auth.logout')
    current = null
    return true
  },

  'auth.me': () => (current ? { ...current, perms: ROLE_PERMS[current.role] } : null),

  'auth.changePin': (a: { old_pin: string; new_pin: string }) => {
    const u = requireUser()
    if (!checkCredentials(u.username, a.old_pin)) throw new Error('รหัส PIN เดิมไม่ถูกต้อง')
    validatePin(a.new_pin)
    update('users', u.id, { pin_hash: hashPin(a.new_pin) })
    audit(u.id, 'auth.change_pin', 'users', u.id)
    return true
  },

  'users.list': () =>
    all(
      `SELECT id, username, display_name, role, max_discount_pct, is_vet, license_no, active
       FROM users ORDER BY active DESC, display_name`
    ),

  'users.vets': () =>
    all('SELECT id, display_name, license_no FROM users WHERE is_vet = 1 AND active = 1 ORDER BY display_name'),

  'users.save': (a: {
    id?: string
    username: string
    display_name: string
    role: Role
    pin?: string
    max_discount_pct: number
    is_vet: boolean
    license_no?: string
    active?: boolean
  }) => {
    const me = requirePerm('settings')
    return tx(() => {
      const row = {
        username: a.username.trim(),
        display_name: a.display_name.trim(),
        role: a.role,
        max_discount_pct: Number(a.max_discount_pct) || 0,
        is_vet: a.is_vet,
        license_no: a.license_no,
        active: a.active ?? true
      }
      if (a.id) {
        if (a.id === me.id && (a.role !== 'owner' || a.active === false))
          throw new Error('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้')
        update('users', a.id, a.pin ? { ...row, pin_hash: (validatePin(a.pin), hashPin(a.pin)) } : row)
        audit(me.id, 'user.update', 'users', a.id, { ...row })
        return a.id
      }
      if (!a.pin) throw new Error('กรุณาตั้งรหัส PIN')
      validatePin(a.pin)
      const id = uid()
      insert('users', { id, ...row, pin_hash: hashPin(a.pin) })
      audit(me.id, 'user.create', 'users', id, { ...row })
      return id
    })
  }
}

function validatePin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('รหัส PIN ต้องเป็นตัวเลข 4–8 หลัก')
}
