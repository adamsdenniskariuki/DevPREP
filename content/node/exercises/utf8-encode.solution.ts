function codePoints(text: string): number[] {
  const out: number[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    out.push(cp >= 0xd800 && cp <= 0xdfff ? 0xfffd : cp)
  }
  return out
}

const size = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4)

export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = []
  for (const cp of codePoints(text)) {
    const n = size(cp)
    if (n === 1) bytes.push(cp)
    else if (n === 2) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (n === 3) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return Uint8Array.from(bytes)
}

export function byteLength(text: string): number {
  let total = 0
  for (const cp of codePoints(text)) total += size(cp)
  return total
}
