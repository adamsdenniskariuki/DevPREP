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
  const errors: string[] = []

  let limit = 20
  const rawLimit = params.get('limit')
  if (rawLimit !== null) {
    const n = Number(rawLimit)
    if (rawLimit.trim() === '' || !Number.isInteger(n) || n < 1 || n > 100) errors.push('limit must be an integer from 1 to 100')
    else limit = n
  }

  const cursor = params.get('cursor') || undefined

  let sort: ListQuery['sort'] = { field: allowedSorts[0], dir: 'asc' }
  const rawSort = params.get('sort')
  if (rawSort !== null) {
    const dir = rawSort.startsWith('-') ? 'desc' : 'asc'
    const field = rawSort.replace(/^-/, '')
    if (!allowedSorts.includes(field)) errors.push(`sort field '${field}' is not allowed`)
    else sort = { field, dir }
  }

  const tags = params.getAll('tag')
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { limit, ...(cursor ? { cursor } : {}), sort, tags } }
}
