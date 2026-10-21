import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { all, getDb, getSetting, setSetting, audit, tx, uid, insert, run, nextCounter } from '../db'
import { requirePerm, requireUser } from '../auth'

const EDITABLE_SETTINGS = [
  'shop_name',
  'shop_name_en',
  'shop_address',
  'shop_phone',
  'shop_tax_id',
  'promptpay_id',
  'vat_enabled',
  'vat_inclusive',
  'vat_rate',
  'vat_start_date',
  'receipt_footer',
  'backup_dir'
]

export function backupDir(): string {
  return getSetting('backup_dir') || join(app.getPath('documents'), 'Rimping Backup')
}

/** Copy the live database to a timestamped file and keep the newest `keep` copies. */
export function backupNow(keep = 60): string {
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const file = join(dir, `rimping-${stamp}.db`)
  getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  const files = readdirSync(dir)
    .filter((f) => /^rimping-.*\.db$/.test(f))
    .sort()
  for (const old of files.slice(0, Math.max(files.length - keep, 0))) unlinkSync(join(dir, old))
  return file
}

export function lastBackupDate(): string | null {
  try {
    const files = readdirSync(backupDir()).filter((f) => /^rimping-.*\.db$/.test(f)).sort()
    if (!files.length) return null
    return statSync(join(backupDir(), files[files.length - 1])).mtime.toISOString()
  } catch {
    return null
  }
}

export const systemApi = {
  'settings.get': () => {
    const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings')
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  },

  'settings.save': (a: Record<string, string>) => {
    const u = requirePerm('settings')
    tx(() => {
      const changed: Record<string, [string, string]> = {}
      for (const k of EDITABLE_SETTINGS) {
        if (a[k] === undefined) continue
        const before = getSetting(k)
        const after = String(a[k] ?? '')
        if (before !== after) {
          setSetting(k, after)
          changed[k] = [before, after]
        }
      }
      if (Object.keys(changed).length) audit(u.id, 'settings.update', 'settings', undefined, changed)
    })
    return true
  },

  'system.backupNow': () => {
    const u = requireUser()
    const file = backupNow()
    audit(u.id, 'system.backup', undefined, undefined, { file })
    return file
  },

  'system.info': () => ({
    version: app.getVersion(),
    db_path: join(app.getPath('userData'), 'rimping.db'),
    backup_dir: backupDir(),
    last_backup: lastBackupDate(),
    pending_sync: (all<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox WHERE synced_at IS NULL')[0]?.n ?? 0)
  })
}

/**
 * Demo only (RIMPING_DEMO=1): back-fill about a year of realistic sales so trend charts have data.
 * Never available in the clinic's real install.
 */
export const demoApi = {
  'system.demoHistory': (a: { months?: number }) => {
    if (process.env.RIMPING_DEMO !== '1') throw new Error('ใช้ได้เฉพาะโหมดทดลอง')
    const products = all<any>("SELECT * FROM products WHERE active = 1 AND category <> 'boarding'")
    const customers = all<any>('SELECT c.id, (SELECT id FROM pets p WHERE p.customer_id = c.id LIMIT 1) AS pet_id FROM customers c')
    const owner = all<any>("SELECT id FROM users WHERE role = 'owner' LIMIT 1")[0]
    if (!products.length || !customers.length || !owner) return 0
    let seed = 7
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const pick = <T,>(l: T[]): T => l[Math.floor(rnd() * l.length)]
    const p2 = (n: number): string => String(n).padStart(2, '0')
    let made = 0
    tx(() => {
      const start = new Date()
      start.setMonth(start.getMonth() - (a.months ?? 12))
      for (const d = new Date(start); d < new Date(new Date().toDateString()); d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0 && rnd() < 0.7) continue
        const monthsAgo = (Date.now() - d.getTime()) / (30 * 86400000)
        const growth = 1 + (12 - monthsAgo) * 0.025
        const bills = Math.round((3 + rnd() * 5) * growth)
        const day = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
        const key = `${String(d.getFullYear() + 543).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
        for (let b = 0; b < bills; b++) {
          const c = pick(customers)
          const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(products))
          let subtotal = 0
          let cost = 0
          const id = uid()
          const time = `${day} ${p2(9 + Math.floor(rnd() * 10))}:${p2(Math.floor(rnd() * 60))}:00`
          const items = lines.map((p, i) => {
            const qty = p.category === 'medicine' ? 5 + Math.floor(rnd() * 10) : 1
            subtotal += qty * p.price
            cost += qty * p.avg_cost
            return { id: uid(), invoice_id: id, seq: i + 1, product_id: p.id, name: p.name, category: p.category, unit: p.unit, qty, unit_price: p.price, discount: 0, line_total: qty * p.price, unit_cost: p.avg_cost, vat_type: p.vat_type, vet_id: p.needs_vet ? owner.id : null, created_at: time, updated_at: time }
          })
          const no = `${key}${String(nextCounter(`BILL${key}`)).padStart(3, '0')}`
          insert('invoices', { id, invoice_no: no, customer_id: c.id, pet_id: c.pet_id, status: 'paid', subtotal, total: subtotal, paid_amount: subtotal, cost_total: cost, created_by: owner.id, issued_at: time, created_at: time, updated_at: time })
          for (const it of items) insert('invoice_items', it)
          insert('payments', { id: uid(), invoice_id: id, customer_id: c.id, kind: 'payment', method: pick(['cash', 'cash', 'transfer', 'promptpay', 'card']), amount: subtotal, created_by: owner.id, paid_at: time, created_at: time, updated_at: time })
          if (c.pet_id && rnd() < 0.5) insert('visits', { id: uid(), pet_id: c.pet_id, vet_id: owner.id, visit_date: day, subjective: 'ตรวจทั่วไป', invoice_id: id, created_at: time, updated_at: time })
          made++
        }
      }
      // spread customer sign-up dates over the year so "new customers" trends look real
      for (const c of customers) {
        const back = Math.floor(rnd() * 360)
        const d = new Date(Date.now() - back * 86400000)
        const t = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} 10:00:00`
        run('UPDATE customers SET created_at = ? WHERE id = ?', t, c.id)
      }
    })
    return made
  }
}
