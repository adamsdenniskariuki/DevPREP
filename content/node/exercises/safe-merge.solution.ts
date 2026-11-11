type Json = Record<string, unknown>

const BLOCKED = new Set(['__proto__', 'constructor', 'prototype'])
const isPlain = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value)

export function safeMerge(target: Json, source: Json): Json {
  const out: Json = { ...target }
  for (const key of Object.keys(source)) {
    if (BLOCKED.has(key)) continue
    const value = source[key]
    const current = out[key]
    out[key] = isPlain(value) && isPlain(current) ? safeMerge(current, value) : value
  }
  return out
}
