import { describe, expect, it } from 'vitest'
import navIndex from './generated/nav-index.json' with { type: 'json' }
import { lessons, tracks } from './curriculum'
import { problemIndex } from './problems'
import { sqlProblemIndex } from './sql-problems'
import { caseIndex } from './cases'
import { guideIndex, guideIds } from './guides'
import { patternIndex, patternIds } from './patterns'
import { companyIds } from './companies'
import { problemIds } from './problems'
import { sqlProblemIds } from './sql-problems'
import { caseIds } from './cases'
import type { NavIndex } from './nav-model'
import { buildPaletteIndex, KIND_LABELS, PAGES, scoreEntry, searchPalette, snippetEntries, SUGGESTED } from './palette-index'
import { ROUTES, parseHash } from './routes'
import type { RouteIds } from './routes'

const index = navIndex as unknown as NavIndex
const entries = buildPaletteIndex(index, lessons)
const ids: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds }
const ofKind = (kind: string) => entries.filter(entry => entry.kind === kind)

describe('buildPaletteIndex', () => {
  it('covers pages, tracks, lessons, patterns, guides, anti-patterns, problems, SQL, decks, cases and companies', () => {
    expect(ofKind('track').map(entry => entry.href)).toEqual(tracks.map(track => `#tracks/${track.id}`))
    expect(ofKind('lesson')).toHaveLength(lessons.length)
    expect(ofKind('pattern').map(entry => entry.href)).toEqual(patternIndex.map(item => `#patterns/${item.id}`))
    expect(ofKind('guide').map(entry => entry.href)).toEqual(guideIndex.map(item => `#guide/${item.id}`))
    expect(ofKind('antipattern')).toHaveLength(guideIndex.reduce((sum, item) => sum + item.antipatterns, 0))
    expect(ofKind('problem').map(entry => entry.title)).toEqual(problemIndex.map(item => item.title))
    expect(ofKind('problem')[0].detail).toBe(problemIndex[0].pattern)
    expect(ofKind('sql').map(entry => entry.href)).toEqual(sqlProblemIndex.map(item => `#sql/${item.id}`))
    expect(ofKind('deck')).toHaveLength(tracks.length)
    expect(ofKind('case').map(entry => entry.href)).toEqual(caseIndex.map(item => `#design/${item.id}`))
    expect(ofKind('company').map(entry => entry.href)).toEqual(companyIds.flatMap(id => [`#company/${id}`, `#mock/${id}`]))
    const sub = patternIndex.find(item => item.parent)!
    expect(entries.find(entry => entry.id === `pattern:${sub.id}`)!.detail).toBe(patternIndex.find(item => item.id === sub.parent)!.title)
  })

  it('has a page entry for every top-level route except the lesson player', () => {
    const hrefs = new Set(PAGES.map(page => page.href))
    for (const route of ROUTES.filter(item => item !== 'study')) expect(hrefs, route).toContain(`#${route}`)
    expect(PAGES.find(page => page.title === 'Site map')!.href).toBe('#map')
  })

  it('links only to routes the app accepts and gives every entry a unique id', () => {
    for (const entry of entries) expect(parseHash(entry.href, ids).route, `${entry.id} ${entry.href}`).not.toBe('unknown')
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length)
    for (const id of SUGGESTED) expect(entries.some(entry => entry.id === id), id).toBe(true)
  })

  it('lists Playground snippets saved on this device', () => {
    const snippets = snippetEntries([{ id: 's-abc-123', name: 'Prime sieve', lang: 'py' }, { id: 's-def-456', name: 'Joins', lang: 'sql' }])
    expect(snippets.map(entry => [entry.id, entry.href, entry.detail])).toEqual([['snippet:s-abc-123', '#playground/s-abc-123', 'Python snippet'], ['snippet:s-def-456', '#playground/s-def-456', 'SQL snippet']])
    for (const entry of snippets) expect(parseHash(entry.href, ids)).toEqual({ route: 'playground', snippetId: entry.href.split('/')[1] })
    const groups = searchPalette([...entries, ...snippets], 'prime sieve')
    expect(groups[0].label).toBe(KIND_LABELS.snippet)
    expect(groups[0].items[0].title).toBe('Prime sieve')
    expect(searchPalette(entries, 'playground')[0].items[0].href).toBe('#playground')
  })

  it('works with an index that has no lessons passed in', () => {
    expect(buildPaletteIndex(index).some(entry => entry.kind === 'lesson')).toBe(false)
  })
})

describe('searchPalette', () => {
  it('shows suggestions, after recent destinations, for an empty query', () => {
    const empty = searchPalette(entries, '')
    expect(empty.map(group => group.label)).toEqual(['Suggested'])
    expect(empty[0].items.map(entry => entry.id)).toEqual(SUGGESTED)
    const problem = `problem:${problemIndex[0].id}`
    const withRecent = searchPalette(entries, '  ', { recent: [problem, 'page:home', 'gone:id'] })
    expect(withRecent.map(group => group.label)).toEqual(['Recent', 'Suggested'])
    expect(withRecent[0].items.map(entry => entry.id)).toEqual([problem, 'page:home'])
    expect(withRecent[1].items.map(entry => entry.id)).not.toContain('page:home')
  })

  it('groups results by kind with headings, caps each group and counts the rest', () => {
    const groups = searchPalette(entries, 'a', { perGroup: 3 })
    expect(groups.length).toBeGreaterThan(3)
    expect(new Set(groups.map(group => group.kind)).size).toBe(groups.length)
    for (const group of groups) {
      expect(group.label).toBe(KIND_LABELS[group.kind as keyof typeof KIND_LABELS])
      expect(group.items.length).toBeLessThanOrEqual(3)
      expect(group.items.every(entry => entry.kind === group.kind)).toBe(true)
    }
    expect(groups.find(group => group.kind === 'problem')!.more).toBeGreaterThan(0)
  })

  it('puts the exact problem first in the first group', () => {
    const problem = problemIndex[5]
    const [first] = searchPalette(entries, problem.title)
    expect(first.kind).toBe('problem')
    expect(first.items[0].href).toBe(`#code/${problem.id}`)
  })

  it('finds pages by their keywords and fuzzy abbreviations', () => {
    const [first] = searchPalette(entries, 'sitemap')
    expect(first.items[0].href).toBe('#map')
    expect(searchPalette(entries, 'dark mode')[0].items[0].href).toBe('#settings')
    const dijkstra = patternIndex.find(item => /dijkstra/i.test(item.title))
    if (dijkstra) expect(searchPalette(entries, 'dijkstr').find(group => group.kind === 'pattern')!.items[0].href).toBe(`#patterns/${dijkstra.id}`)
    expect(searchPalette(entries, 'zzzzqqq')).toEqual([])
  })

  it('scores titles above detail-only matches', () => {
    const problem = entries.find(entry => entry.kind === 'problem')!
    expect(scoreEntry(problem.title, problem)!).toBeGreaterThan(scoreEntry(problem.detail!, problem)!)
    expect(scoreEntry('qqqq', problem)).toBeNull()
  })
})
