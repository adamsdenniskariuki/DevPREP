type Json = Record<string, unknown>

export function safeMerge(target: Json, source: Json): Json {
  // TODO: merge into a copy and skip dangerous keys.
  for (const key in source) {
    const value = source[key]
    const current = target[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object') {
      safeMerge(current as Json, value as Json)
    } else {
      target[key] = value
    }
  }
  return target
}
