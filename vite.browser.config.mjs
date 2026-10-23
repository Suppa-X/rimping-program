// Builds the in-browser demo (static files, no server): npm run web:static → out/web-static/
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const shim = (f) => resolve('src/web/browser', f)

export default defineConfig({
  root: 'src/web/browser',
  base: './',
  plugins: [react()],
  define: { 'process.env.RIMPING_DEMO': '"1"' },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      electron: shim('electron.ts'),
      'node:sqlite': shim('sqlite.ts'),
      'node:crypto': shim('crypto.ts'),
      'node:fs': shim('fs.ts'),
      'node:path': shim('path.ts')
    }
  },
  build: { outDir: resolve('out/web-static'), emptyOutDir: true, chunkSizeWarningLimit: 4000 }
})
