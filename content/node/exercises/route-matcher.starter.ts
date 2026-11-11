export type Match = { handler: string; params: Record<string, string> } | { status: 404 } | { status: 405; allow: string[] }

export function createRouter() {
  const routes: Array<{ method: string; pattern: string; handler: string }> = []
  return {
    add(method: string, pattern: string, handler: string) {
      routes.push({ method, pattern, handler })
    },
    match(method: string, path: string): Match {
      // TODO: support :params, *, query strings and 405.
      const route = routes.find(r => r.method === method && r.pattern === path)
      return route ? { handler: route.handler, params: {} } : { status: 404 }
    },
  }
}
