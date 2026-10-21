// Bundles the web demo server: the real backend, with Electron swapped for a small stub.
import { resolve } from 'node:path'
import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/web/server.ts',
  platform: 'node',
  resolve: { alias: { electron: resolve('src/web/electron-stub.ts') } },
  external: ['node:sqlite', 'qrcode', 'promptpay-qr'],
  output: { file: 'out/web/server.js', format: 'cjs' }
})
