import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('rimping', {
  call: (method: string, args?: unknown) => ipcRenderer.invoke('api', method, args),
  openPrint: (route: string) => ipcRenderer.invoke('print:open', route)
})
