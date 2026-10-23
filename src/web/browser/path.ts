// Minimal node:path stand-in for the in-browser demo.
export const join = (...parts: string[]): string => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
export const basename = (p: string): string => p.split(/[/\\]/).pop() ?? ''
export const extname = (p: string): string => {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i > 0 ? b.slice(i) : ''
}
