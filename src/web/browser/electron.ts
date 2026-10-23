// Stand-in for the Electron APIs the backend touches, for the in-browser demo.
const desktopOnly = async (): Promise<never> => {
  throw new Error('การแนบไฟล์ใช้ได้ในโปรแกรมบนเครื่องเท่านั้น (เว็บนี้เป็น Demo)')
}
export const app = { getPath: (): string => '/demo', getVersion: (): string => 'web-demo' }
export const dialog = { showOpenDialog: desktopOnly }
export const shell = { openPath: async (): Promise<string> => '' }
export const BrowserWindow = { getFocusedWindow: (): null => null }
