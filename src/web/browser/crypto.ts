// node:crypto stand-ins for the in-browser demo. PIN hashing here is NOT secure — demo data only.
import { Buffer } from 'buffer'

export const randomUUID = (): string => globalThis.crypto.randomUUID()

export const randomBytes = (n: number): Buffer => Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(n)))

export function scryptSync(pin: string, salt: Uint8Array, len: number): Buffer {
  const out = Buffer.alloc(len)
  let h = 2166136261
  const src = pin + Buffer.from(salt).toString('hex')
  for (let i = 0; i < len; i++) {
    for (const c of src + i) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
    out[i] = h & 0xff
  }
  return out
}

export const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i])
