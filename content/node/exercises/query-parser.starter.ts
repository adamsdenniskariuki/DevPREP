export interface ListQuery { limit: number; cursor?: string; sort: { field: string; dir: 'asc' | 'desc' }; tags: string[] }
export type Parsed = { ok: true; value: ListQuery } | { ok: false; errors: string[] }

function parseSearch(search: string): Map<string, string[]> {
  const params = new Map<string, string[]>()
  for (const pair of search.replace(/^\?/, '').split('&')) {
    if (!pair) continue
    const [rawName, ...rest] = pair.split('=')
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '))
    const name = decode(rawName)
    params.set(name, [...(params.get(name) ?? []), decode(rest.join('='))])
  }
  return params
}

export function parseListQuery(search: string, allowedSorts: string[]): Parsed {
  const all = parseSearch(search)
  const params = { get: (name: string) => all.get(name)?.[0] ?? null, getAll: (name: string) => all.get(name) ?? [] }
  // TODO: validate, apply defaults and collect errors.
  return {
    ok: true,
    value: {
      limit: Number(params.get('limit')),
      cursor: params.get('cursor') ?? undefined,
      sort: { field: params.get('sort') ?? allowedSorts[0], dir: 'asc' },
      tags: params.getAll('tag'),
    },
  }
}
