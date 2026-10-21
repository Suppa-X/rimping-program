// Stand-in for the few Electron APIs the backend touches, so it can run as a plain Node web server (demo only).
import { join } from 'node:path'

const dataDir = process.env.RIMPING_DATA ?? join(process.cwd(), 'web-demo-data')

export const app = {
  getPath: (name: string): string => (name === 'documents' ? join(dataDir, 'documents') : dataDir),
  getVersion: (): string => process.env.npm_package_version ?? 'web-demo'
}

export const dialog = {
  showOpenDialog: async (): Promise<{ canceled: boolean; filePaths: string[] }> => {
    throw new Error('การแนบไฟล์ใช้ได้ในโปรแกรมบนเครื่องเท่านั้น (เวอร์ชันเว็บเป็น Demo)')
  }
}

export const shell = { openPath: async (): Promise<string> => '' }

export const BrowserWindow = { getFocusedWindow: (): null => null }
