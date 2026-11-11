export interface LinkConfig { prefixes: string[]; screens: Record<string, string> }
export interface LinkMatch { screen: string; params: Record<string, string> }

const decode = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '))

export function parseDeepLink(url: string, config: LinkConfig): LinkMatch | null {
  const prefix = config.prefixes.find(p => url.startsWith(p))
  if (prefix === undefined) return null
  const rest = url.slice(prefix.length)
  const q = rest.indexOf('?')
  const path = q < 0 ? rest : rest.slice(0, q)
  const query: Record<string, string> = {}
  if (q >= 0) {
    for (const pair of rest.slice(q + 1).split('&')) {
      if (!pair) continue
      const eq = pair.indexOf('=')
      const key = decode(eq < 0 ? pair : pair.slice(0, eq))
      query[key] = eq < 0 ? '' : decode(pair.slice(eq + 1))
    }
  }
  const parts = path.split('/').filter(Boolean)
  for (const [screen, pattern] of Object.entries(config.screens)) {
    const want = pattern.split('/').filter(Boolean)
    if (want.length !== parts.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < want.length && ok; i++) {
      if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(parts[i])
      else ok = want[i] === parts[i]
    }
    if (ok) return { screen, params: { ...query, ...params } }
  }
  return null
}
