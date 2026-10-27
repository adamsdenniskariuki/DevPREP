import { describe, expect, it } from 'vitest'
import { tracks } from './curriculum'
import { problemIds } from './problems'
import { sqlProblemIds } from './sql-problems'
import { caseIds } from './cases'
import { guideIds } from './guides'
import { patternIds } from './patterns'
import { companyIds } from './companies'
import { ALIASES, ROUTES, hrefFor, parseHash } from './routes'
import type { ParsedRoute, RouteIds } from './routes'

const ids: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds }

/** The parser as it shipped before the navigation redesign, kept verbatim as the compatibility oracle. */
function legacyParse(hash: string): ParsedRoute {
  const routes = ['home', 'tracks', 'practice', 'progress', 'settings', 'study', 'code', 'design', 'board', 'cards', 'mock', 'stories', 'plan', 'guide', 'antipatterns', 'sql', 'patterns', 'company']
  const aliases: Record<string, string> = { today: 'home', roadmap: 'tracks', review: 'practice' }
  const PATTERN_VIEWS = new Set(['pick', 'cheatsheet'])
  const BOARD_ID = /^[a-z0-9-]{1,64}$/
  const [head, sub, ...rest] = hash.slice(1).split('/')
  const route = (aliases[head || 'home'] ?? routes.find(item => item === (head || 'home'))) as ParsedRoute['route'] | undefined
  if (!route || rest.length) return { route: 'unknown' }
  if (sub === undefined) return { route }
  if (route === 'code') return problemIds.has(sub) ? { route, problemId: sub } : { route: 'unknown' }
  if (route === 'sql') return sqlProblemIds.has(sub) ? { route, sqlId: sub } : { route: 'unknown' }
  if (route === 'design') return caseIds.has(sub) ? { route, caseId: sub } : { route: 'unknown' }
  if (route === 'company' || route === 'mock') return companyIds.includes(sub) ? { route, companyId: sub } : { route: 'unknown' }
  if (route === 'board') return BOARD_ID.test(sub) ? { route, boardId: sub } : { route: 'unknown' }
  if (route === 'guide') return guideIds.has(sub) ? { route, guideId: sub } : { route: 'unknown' }
  if (route === 'patterns') return patternIds.has(sub) || PATTERN_VIEWS.has(sub) ? { route, patternView: sub } : { route: 'unknown' }
  const track = tracks.find(item => item.id === sub)?.id
  return route === 'tracks' && track ? { route, track } : { route: 'unknown' }
}

/** Every route, alias and sub-id the app has ever accepted, plus near misses that must stay unknown. */
const hashes = [
  '', '#', '#home', '#today', '#roadmap', '#review',
  ...ROUTES.map(route => `#${route}`),
  ...Object.keys(ALIASES).map(alias => `#${alias}`),
  ...tracks.map(track => `#tracks/${track.id}`), ...tracks.map(track => `#roadmap/${track.id}`),
  ...[...problemIds].map(id => `#code/${id}`),
  ...[...sqlProblemIds].map(id => `#sql/${id}`),
  ...[...caseIds].map(id => `#design/${id}`),
  ...[...guideIds].map(id => `#guide/${id}`),
  ...[...patternIds].map(id => `#patterns/${id}`), '#patterns/pick', '#patterns/cheatsheet',
  ...companyIds.flatMap(id => [`#company/${id}`, `#mock/${id}`]),
  '#board/abc-123', '#board/Bad_Id', `#board/${'a'.repeat(65)}`, '#board/',
  '#code/nope', '#sql/nope', '#design/nope', '#guide/nope', '#patterns/nope', '#company/nope', '#mock/nope', '#tracks/nope',
  '#home/extra', '#practice/x', '#settings/a/b', '#code/two-sum/extra', '#search', '#Home', '#practise', '#nope',
]
/** Routes added by the redesign, which the legacy parser did not know. */
const ADDED = new Set(['#map'])

describe('route compatibility', () => {
  it('parses every existing route, alias and sub-id exactly as before the redesign', () => {
    expect(hashes.length).toBeGreaterThan(300)
    for (const hash of hashes.filter(item => !ADDED.has(item))) expect(parseHash(hash, ids), hash).toEqual(legacyParse(hash || '#'))
  })

  it('adds the site map as a new top-level route with no sub-pages', () => {
    expect(ROUTES).toContain('map')
    expect(parseHash('#map', ids)).toEqual({ route: 'map' })
    expect(parseHash('map', ids)).toEqual({ route: 'map' })
    expect(hrefFor({ route: 'map' })).toBe('#map')
    for (const hash of ['#map/x', '#map/a/b', '#Map', '#sitemap']) expect(parseHash(hash, ids), hash).toEqual({ route: 'unknown' })
  })

  it('keeps the old aliases pointing at the same screens', () => {
    expect(parseHash('#today', ids)).toEqual({ route: 'home' })
    expect(parseHash('#roadmap', ids)).toEqual({ route: 'tracks' })
    expect(parseHash('#review', ids)).toEqual({ route: 'practice' })
    expect(parseHash('', ids)).toEqual({ route: 'home' })
  })

  it('accepts a hash with or without the leading #', () => {
    expect(parseHash('code', ids)).toEqual(parseHash('#code', ids))
    expect(parseHash(`tracks/${tracks[0].id}`, ids)).toEqual({ route: 'tracks', track: tracks[0].id })
  })

  it('builds the canonical href for any parsed route', () => {
    for (const hash of hashes) {
      const parsed = parseHash(hash, ids)
      if (parsed.route === 'unknown') { expect(hrefFor(parsed)).toBe(''); continue }
      expect(parseHash(hrefFor(parsed), ids), hash).toEqual(parsed)
    }
    expect(hrefFor(parseHash('#today', ids))).toBe('#home')
  })
})
