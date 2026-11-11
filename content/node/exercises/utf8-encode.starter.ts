export function utf8Encode(text: string): Uint8Array {
  // TODO: handle characters above 0x7f.
  return Uint8Array.from(text, ch => ch.charCodeAt(0) & 0xff)
}

export function byteLength(text: string): number {
  return text.length
}
