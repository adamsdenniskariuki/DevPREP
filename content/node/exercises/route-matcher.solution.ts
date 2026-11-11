export type Match = { handler: string; params: Record<string, string> } | { status: 404 } | { status: 405; allow: string[] }

interface Route { method: string; parts: string[]; handler: string }

function matchPath(parts: string[], segments: string[]): Record<string, string> | null {
  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '*' && i === parts.length - 1) {
      params['*'] = segments.slice(i).map(decodeURIComponent).join('/')
      return params
    }
    const segment = segments[i]
    if (segment === undefined) return null
    if (part.startsWith(':')) {
      if (!segment) return null
      params[part.slice(1)] = decodeURIComponent(segment)
    } else if (part !== segment) {
      return null
    }
  }
  return parts.length === segments.length ? params : null
}

export function createRouter() {
  const routes: Route[] = []
  return {
    add(method: string, pattern: string, handler: string) {
      routes.push({ method, parts: pattern.split('/'), handler })
    },
    match(method: string, path: string): Match {
      let clean = path.split('?')[0]
      if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1)
      const segments = clean.split('/')
      const allow: string[] = []
      for (const route of routes) {
        const params = matchPath(route.parts, segments)
        if (!params) continue
        if (route.method === method) return { handler: route.handler, params }
        if (!allow.includes(route.method)) allow.push(route.method)
      }
      return allow.length ? { status: 405, allow } : { status: 404 }
    },
  }
}
