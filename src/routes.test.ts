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
const ADDED = new Set(['#map', '#playground', '#changelog', '#plans', '#codebase', '#react', '#skilltest', '#node', '#react-native'])

describe('route compatibility', () => {
  it('parses every existing route, alias and sub-id exactly as before the redesign', () => {
    expect(hashes.length).toBeGreaterThan(300)
    for (const hash of hashes.filter(item => !ADDED.has(item))) expect(parseHash(hash, ids), hash).toEqual(legacyParse(hash || '#'))
  })

  it('accepts an optional language on a problem link and nowhere else', () => {
    for (const lang of ['js', 'py', 'ts'] as const) {
      expect(parseHash(`#code/count-pair-sums/${lang}`, ids)).toEqual({ route: 'code', problemId: 'count-pair-sums', codeLang: lang })
    }
    expect(parseHash('#code/count-pair-sums', ids).codeLang).toBeUndefined()
    expect(hrefFor(parseHash('#code/count-pair-sums/ts', ids))).toBe('#code/count-pair-sums')
    for (const hash of ['#code/count-pair-sums/rust', '#code/count-pair-sums/TS', '#code/count-pair-sums/ts/x', '#code/nope/ts', '#code//ts', '#sql/x/ts', '#tracks/python/ts']) {
      expect(parseHash(hash, ids), hash).toEqual({ route: 'unknown' })
    }
  })

  it('adds the changelog as a top-level route with no sub-pages', () => {
    expect(parseHash('#changelog', ids)).toEqual({ route: 'changelog' })
    for (const hash of ['#changelog/1.8.0', '#changelog/x', '#Changelog']) expect(parseHash(hash, ids), hash).toEqual({ route: 'unknown' })
  })

  it('adds the site map as a new top-level route with no sub-pages', () => {
    expect(ROUTES).toContain('map')
    expect(parseHash('#map', ids)).toEqual({ route: 'map' })
    expect(parseHash('map', ids)).toEqual({ route: 'map' })
    expect(hrefFor({ route: 'map' })).toBe('#map')
    for (const hash of ['#map/x', '#map/a/b', '#Map', '#sitemap']) expect(parseHash(hash, ids), hash).toEqual({ route: 'unknown' })
  })

  it('adds the Playground, with an optional snippet id', () => {
    expect(ROUTES).toContain('playground')
    expect(parseHash('#playground', ids)).toEqual({ route: 'playground' })
    expect(parseHash('#playground/s-lz3k9a-ab12cd', ids)).toEqual({ route: 'playground', snippetId: 's-lz3k9a-ab12cd' })
    expect(hrefFor({ route: 'playground', snippetId: 's-1' })).toBe('#playground/s-1')
    for (const hash of ['#playground/Bad_Id', '#playground/a/b', '#Playground', "#playground/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]) expect(parseHash(hash, ids), hash).toEqual({ route: 'unknown' })
  })

  it('adds codebase interviews, with an optional repo/task pair', () => {
    const withTasks: RouteIds = { ...ids, codebase: new Set(['inventory/fix-restock']) }
    expect(parseHash('#codebase', withTasks)).toEqual({ route: 'codebase' })
    expect(parseHash('#codebase/inventory/fix-restock', withTasks)).toEqual({ route: 'codebase', codebaseTask: 'inventory/fix-restock' })
    expect(hrefFor({ route: 'codebase', codebaseTask: 'inventory/fix-restock' })).toBe('#codebase/inventory/fix-restock')
    for (const hash of ['#codebase/inventory', '#codebase/inventory/nope', '#codebase/a/b/c', '#Codebase']) expect(parseHash(hash, withTasks), hash).toEqual({ route: 'unknown' })
  })

  it('adds the React module and skill tests, each with an optional id', () => {
    const withIds: RouteIds = { ...ids, react: new Set(['react-state', 'counter']), skillTests: new Set(['react']) }
    expect(parseHash('#react', withIds)).toEqual({ route: 'react' })
    expect(parseHash('#react/react-state', withIds)).toEqual({ route: 'react', reactId: 'react-state' })
    expect(parseHash('#skilltest', withIds)).toEqual({ route: 'skilltest' })
    expect(parseHash('#skilltest/react', withIds)).toEqual({ route: 'skilltest', skillTestId: 'react' })
    expect(hrefFor({ route: 'react', reactId: 'counter' })).toBe('#react/counter')
    expect(hrefFor({ route: 'skilltest', skillTestId: 'react' })).toBe('#skilltest/react')
    for (const hash of ['#react/nope', '#react/counter/x', '#skilltest/nope', '#skilltest/react/x', '#React']) expect(parseHash(hash, withIds), hash).toEqual({ route: 'unknown' })
    expect(parseHash('#react/any-id', ids)).toEqual({ route: 'react', reactId: 'any-id' })
  })

  it('adds the Node.js module with an optional lesson or exercise id', () => {
    const withIds: RouteIds = { ...ids, node: new Set(['node-event-loop', 'promise-pool']), skillTests: new Set(['node']) }
    expect(parseHash('#node', withIds)).toEqual({ route: 'node' })
    expect(parseHash('#node/node-event-loop', withIds)).toEqual({ route: 'node', nodeId: 'node-event-loop' })
    expect(parseHash('#node/promise-pool', withIds)).toEqual({ route: 'node', nodeId: 'promise-pool' })
    expect(parseHash('#skilltest/node', withIds)).toEqual({ route: 'skilltest', skillTestId: 'node' })
    expect(hrefFor({ route: 'node', nodeId: 'promise-pool' })).toBe('#node/promise-pool')
    for (const hash of ['#node/nope', '#node/promise-pool/x', '#Node']) expect(parseHash(hash, withIds), hash).toEqual({ route: 'unknown' })
    expect(parseHash('#node/any-id', ids)).toEqual({ route: 'node', nodeId: 'any-id' })
  })

  it('adds the React Native module with an optional lesson or exercise id', () => {
    const withIds: RouteIds = { ...ids, reactNative: new Set(['rn-lists', 'offline-queue']), skillTests: new Set(['react-native']) }
    expect(parseHash('#react-native', withIds)).toEqual({ route: 'react-native' })
    expect(parseHash('#react-native/rn-lists', withIds)).toEqual({ route: 'react-native', reactNativeId: 'rn-lists' })
    expect(parseHash('#skilltest/react-native', withIds)).toEqual({ route: 'skilltest', skillTestId: 'react-native' })
    expect(hrefFor({ route: 'react-native', reactNativeId: 'offline-queue' })).toBe('#react-native/offline-queue')
    for (const hash of ['#react-native/nope', '#react-native/offline-queue/x', '#React-Native']) expect(parseHash(hash, withIds), hash).toEqual({ route: 'unknown' })
    expect(parseHash('#react-native/any-id', ids)).toEqual({ route: 'react-native', reactNativeId: 'any-id' })
  })

  it('links straight to a lesson inside its own track', () => {
    const withLessons: RouteIds = { ...ids, lessons: new Map([['ts-generics', 'typescript'], ['py-basics', 'python']]) }
    expect(parseHash('#tracks/typescript/ts-generics', withLessons)).toEqual({ route: 'tracks', track: 'typescript', lessonId: 'ts-generics' })
    expect(hrefFor({ route: 'tracks', track: 'typescript', lessonId: 'ts-generics' })).toBe('#tracks/typescript/ts-generics')
    for (const hash of ['#tracks/typescript/nope', '#tracks/python/ts-generics', '#tracks/typescript/ts-generics/x', '#tracks/nope/ts-generics']) expect(parseHash(hash, withLessons), hash).toEqual({ route: 'unknown' })
    expect(parseHash('#tracks/typescript/ts-generics', ids)).toEqual({ route: 'unknown' })
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
