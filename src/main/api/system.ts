import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { all, getDb, getSetting, setSetting, audit, tx } from '../db'
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
