const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function encode(bytes: Uint8Array, url = false): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const left = bytes.length - i
    const n = (bytes[i] << 16) | ((left > 1 ? bytes[i + 1] : 0) << 8) | (left > 2 ? bytes[i + 2] : 0)
    const chars = [(n >> 18) & 63, (n >> 12) & 63, (n >> 6) & 63, n & 63].map(v => ALPHABET[v])
    const keep = left >= 3 ? 4 : left + 1
    out += chars.slice(0, keep).join('') + '='.repeat(4 - keep)
  }
  return url ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out
}

export function decode(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) throw new Error(`invalid base64 character '${ch}'`)
    value = (value << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}
