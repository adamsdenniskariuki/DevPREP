interface Version { major: number; minor: number; patch: number; pre: string[] }

function parse(text: string): Version {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text.trim())
  if (!m) throw new Error(`Invalid version: ${text}`)
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split('.') : [] }
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0)

function comparePre(a: string[], b: string[]): -1 | 0 | 1 {
  if (!a.length || !b.length) return sign(b.length - a.length)
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i]
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) { const d = sign(Number(x) - Number(y)); if (d) return d; continue }
    if (xn !== yn) return xn ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return sign(a.length - b.length)
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const x = parse(a), y = parse(b)
  return sign(x.major - y.major) || sign(x.minor - y.minor) || sign(x.patch - y.patch) || comparePre(x.pre, y.pre)
}

function bounds(op: string, v: string): string[] {
  const { major, minor, patch } = parse(v)
  if (op === '^') {
    const upper = major > 0 ? `${major + 1}.0.0` : minor > 0 ? `0.${minor + 1}.0` : `0.0.${patch + 1}`
    return [`>=${v}`, `<${upper}`]
  }
  if (op === '~') return [`>=${v}`, `<${major}.${minor + 1}.0`]
  return [`${op}${v}`]
}

function test(version: string, comparator: string): boolean {
  const m = /^(>=|<=|>|<|=)?(.+)$/.exec(comparator)!
  const c = compare(version, m[2])
  switch (m[1] ?? '=') {
    case '>=': return c >= 0
    case '<=': return c <= 0
    case '>': return c > 0
    case '<': return c < 0
    default: return c === 0
  }
}

export function satisfies(version: string, range: string): boolean {
  return range.trim().split(/\s+/).every(part => {
    const m = /^([\^~])(.+)$/.exec(part)
    const comparators = m ? bounds(m[1], m[2]) : [part]
    return comparators.every(c => test(version, c))
  })
}
