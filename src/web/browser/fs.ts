// node:fs stand-in: the in-browser demo has no file system (backup and attachments are desktop-only).
const unsupported = (): never => {
  throw new Error('ใช้ได้ในโปรแกรมบนเครื่องเท่านั้น (เว็บนี้เป็น Demo)')
}
export const mkdirSync = (): void => {}
export const readdirSync = (): string[] => []
export const statSync = unsupported
export const unlinkSync = unsupported
export const copyFileSync = unsupported
export const readFileSync = unsupported
