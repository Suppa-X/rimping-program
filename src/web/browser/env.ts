// Must load before the backend: it reads process.env and the global Buffer.
import { Buffer } from 'buffer'

const g = globalThis as any
g.Buffer = Buffer
g.process = { env: { RIMPING_DEMO: '1' }, platform: 'browser', cwd: () => '/' }
