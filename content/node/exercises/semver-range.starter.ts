export function compare(a: string, b: string): -1 | 0 | 1 {
  // TODO: compare numerically and handle pre-releases.
  return a === b ? 0 : a < b ? -1 : 1
}

export function satisfies(version: string, range: string): boolean {
  return compare(version, range.replace(/^[\^~>=<]+/, '')) >= 0
}
