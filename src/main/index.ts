import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { authApi } from './auth'
import { clinicApi } from './api/clinic'
import { salesApi } from './api/sales'
import { reportsApi } from './api/reports'
import { admissionsApi } from './api/admissions'
import { systemApi, demoApi, backupNow, lastBackupDate } from './api/system'

const handlers: Record<string, (args: any) => any> = {
  ...authApi,
  ...clinicApi,
  ...salesApi,
  ...reportsApi,
  ...admissionsApi,
  ...systemApi,
  ...demoApi
}

let mainWindow: BrowserWindow | null = null

function loadRoute(win: BrowserWindow, route: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'ริมปิงสัตวแพทย์',
    icon: join(__dirname, '../../resources/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  loadRoute(mainWindow, '/')
}

/** Receipts open in their own A5 preview window with a print button. */
function openPrintWindow(route: string): void {
  const win = new BrowserWindow({
    width: 720,
    height: 900,
    title: 'พิมพ์เอกสาร',
    parent: mainWindow ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  loadRoute(win, route)
}

function scheduleAutoBackup(): void {
  const run = (): void => {
    try {
      const last = lastBackupDate()
      if (!last || Date.now() - new Date(last).getTime() > 12 * 3600 * 1000) backupNow()
    } catch (e) {
      console.error('auto backup failed', e)
    }
  }
  setTimeout(run, 30_000)
  setInterval(run, 3600 * 1000)
}

app.whenReady().then(() => {
  openDb(join(app.getPath('userData'), 'rimping.db'))

  ipcMain.handle('api', async (_e, method: string, args: unknown) => {
    const fn = handlers[method]
    if (!fn) return { ok: false, error: `Unknown method: ${method}` }
    try {
      return { ok: true, data: await fn(args ?? {}) }
    } catch (err: any) {
      console.error(method, err)
      return { ok: false, error: err?.message ?? String(err) }
    }
  })
  ipcMain.handle('print:open', (_e, route: string) => openPrintWindow(route))

  createWindow()
  scheduleAutoBackup()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  try {
    backupNow()
  } catch (e) {
    console.error('backup on quit failed', e)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
