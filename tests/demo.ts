// Demo mode: runs the built app on a separate demo profile filled with sample data, logged in as the owner.
// Run with: npm run demo   (real clinic data is never touched; delete %APPDATA%\Rimping Demo to start over)
//
// Demo accounts (PIN):  owner = 1111 (เจ้าของร้าน/หมอ) · manager = 2222 (ผู้จัดการ) · staff = 3333 (พนักงาน, ลดได้ 5%)
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { seedDemo, seedQueue } from './demo-seed'

process.env.RIMPING_DEMO = '1'
const profile = join(app.getPath('appData'), 'Rimping Demo')
app.setPath('userData', profile)

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

app.on('browser-window-created', async (_e, win: BrowserWindow) => {
  if (BrowserWindow.getAllWindows().length > 1) return
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  win.setTitle('ริมปิงสัตวแพทย์ — โหมดทดลอง')
  win.on('page-title-updated', (e) => e.preventDefault())
  const js = (code: string): Promise<any> => win.webContents.executeJavaScript(code)
  const call = (m: string, a: unknown = {}): Promise<any> =>
    js(`window.rimping.call(${JSON.stringify(m)}, ${JSON.stringify(a)}).then(r => { if (!r.ok) throw new Error(r.error); return r.data })`)
  try {
    if (await call('auth.needsSetup')) await seedDemo(call, join(profile, 'backup'))
    await call('auth.login', { username: 'owner', pin: '1111' })
    await seedQueue(call)
    await js(`location.hash = '#/'; location.reload()`)
  } catch (e) {
    console.error('DEMO SEED ERROR', e)
  }
})


require('./main/index.js')
