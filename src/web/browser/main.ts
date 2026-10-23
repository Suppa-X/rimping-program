// In-browser demo: the real backend runs inside the page on SQLite (sql.js), so it can be hosted as static files.
// Every visitor gets their own fresh sample data; nothing leaves the browser.
import './env'
// The pure-JS build (no WebAssembly) so it also runs where a page's security policy forbids WASM.
import initSqlJs from 'sql.js/dist/sql-asm.js'
import { useSqlJs } from './sqlite'

async function start(): Promise<void> {
  const status = document.getElementById('boot')
  useSqlJs(await initSqlJs())
  const { openDb } = await import('../../main/db')
  const { authApi } = await import('../../main/auth')
  const { clinicApi } = await import('../../main/api/clinic')
  const { salesApi } = await import('../../main/api/sales')
  const { reportsApi } = await import('../../main/api/reports')
  const { admissionsApi } = await import('../../main/api/admissions')
  const { systemApi, demoApi } = await import('../../main/api/system')
  const { seedDemo, seedQueue } = await import('../../../tests/demo-seed')

  const handlers: Record<string, (args: any) => any> = {
    ...authApi, ...clinicApi, ...salesApi, ...reportsApi, ...admissionsApi, ...systemApi, ...demoApi
  }
  const BLOCKED: Record<string, string> = {
    'system.backupNow': 'การสำรองข้อมูลใช้ได้ในโปรแกรมบนเครื่องเท่านั้น (เว็บนี้เป็น Demo)'
  }
  const call = async (method: string, args: unknown = {}): Promise<any> => handlers[method](args)

  openDb('demo')
  if (status) status.textContent = 'กำลังเตรียมข้อมูลตัวอย่าง…'
  await seedDemo(call, '/demo/backup')
  await call('auth.login', { username: 'owner', pin: '1111' })
  await seedQueue(call)

  window.rimping = {
    call: async (method, args) => {
      try {
        if (BLOCKED[method]) throw new Error(BLOCKED[method])
        const fn = handlers[method]
        if (!fn) throw new Error(`Unknown method: ${method}`)
        return { ok: true, data: structuredClone(await fn(args ?? {})) }
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) }
      }
    },
    // Print pages open in the same tab here; their "ปิด" button goes back.
    openPrint: async (route) => {
      location.hash = route
    }
  }
  window.close = () => history.back()

  await import('../../renderer/src/main')
  status?.remove()
}

start().catch((e) => {
  const status = document.getElementById('boot')
  if (status) status.textContent = `เปิดไม่สำเร็จ: ${e?.message ?? e}`
  console.error(e)
})
