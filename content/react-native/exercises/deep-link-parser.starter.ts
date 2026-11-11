export interface LinkConfig { prefixes: string[]; screens: Record<string, string> }
export interface LinkMatch { screen: string; params: Record<string, string> }

export function parseDeepLink(url: string, config: LinkConfig): LinkMatch | null {
  // TODO: prefixes, query string, :params and decoding
  const prefix = config.prefixes.find(p => url.startsWith(p))
  if (prefix === undefined) return null
  const path = url.slice(prefix.length)
  for (const [screen, pattern] of Object.entries(config.screens)) if (pattern === path) return { screen, params: {} }
  return null
}
