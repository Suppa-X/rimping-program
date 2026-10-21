// Web demo: serves the same React screens and backend over HTTP so the app can be tried in any browser.
// Run with: npm run web   → http://localhost:5180  (uses its own demo database in ./web-demo-data)
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { openDb } from '../main/db'
import { authApi } from '../main/auth'
import { clinicApi } from '../main/api/clinic'
import { salesApi } from '../main/api/sales'
import { reportsApi } from '../main/api/reports'
import { admissionsApi } from '../main/api/admissions'
import { systemApi, demoApi } from '../main/api/system'
import { seedDemo, seedQueue } from '../../tests/demo-seed'

process.env.RIMPING_DEMO = '1'
const PORT = Number(process.env.PORT ?? 5180)
const dataDir = process.env.RIMPING_DATA ?? join(process.cwd(), 'web-demo-data')
const root = join(__dirname, '..', 'renderer')

const handlers: Record<string, (args: any) => any> = {
  ...authApi,
  ...clinicApi,
  ...salesApi,
  ...reportsApi,
  ...admissionsApi,
  ...systemApi,
  ...demoApi
}

const call = async (method: string, args: unknown = {}): Promise<any> => handlers[method](args)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml'
}

async function main(): Promise<void> {
  mkdirSync(dataDir, { recursive: true })
  openDb(join(dataDir, 'rimping.db'))
  if (await call('auth.needsSetup')) await seedDemo(call, join(dataDir, 'backup'))
  await call('auth.login', { username: 'owner', pin: '1111' })
  await seedQueue(call)

  createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        let out: unknown
        try {
          const { method, args } = JSON.parse(body)
          const fn = handlers[method]
          out = fn ? { ok: true, data: await fn(args ?? {}) } : { ok: false, error: `Unknown method: ${method}` }
        } catch (e: any) {
          out = { ok: false, error: e?.message ?? String(e) }
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(out))
      })
      return
    }
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '')
    let file = join(root, path || 'index.html')
    if (!file.startsWith(root) || !existsSync(file) || path === '') file = join(root, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  }).listen(PORT, '127.0.0.1', () => console.log(`Rimping web demo → http://localhost:${PORT}`))
}

main()
