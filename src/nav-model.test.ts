import { describe, expect, it } from 'vitest'
import navIndex from './generated/nav-index.json' with { type: 'json' }
import { lessons, tracks } from './curriculum'
import { problemIndex } from './problems'
import { sqlProblemIndex } from './sql-problems'
import { caseIndex } from './cases'
import { guideIndex } from './guides'
import { patternIndex } from './patterns'
import { companyIds } from './companies'
import { emptyProgress } from './progress'
import { ROUTES, parseHash } from './routes'
import type { RouteIds } from './routes'
import { allHrefs, breadcrumbsFor, buildNavTree, currentNode, expandedFor, groupFor, GROUPS, pathTo } from './nav-model'
import type { NavIndex, NavNode, NavProgress } from './nav-model'
import { deepSections } from './nav-deep'
import { problemIds } from './problems'
import { sqlProblemIds } from './sql-problems'
import { caseIds } from './cases'
import { guideIds } from './guides'
import { patternIds } from './patterns'

const index = navIndex as unknown as NavIndex
const full = (progress: NavProgress, due?: number) => buildNavTree(deepSections(progress, index), due)
const ids: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds }
const parse = (hash: string) => parseHash(hash, ids)
const find = (tree: readonly NavNode[], id: string): NavNode | undefined => {
  for (const node of tree) {
    if (node.id === id) return node
    const below = node.children && find(node.children, id)
    if (below) return below
  }
}
const walk = (tree: readonly NavNode[]): NavNode[] => tree.flatMap(node => [node, ...walk(node.children ?? [])])

describe('nav index', () => {
  it('lists every item the app routes to, with the same titles as the eager indexes', () => {
    expect(index.tracks.map(([id]) => id)).toEqual(tracks.map(item => item.id))
    expect(index.tracks.flatMap(([, , items]) => items)).toEqual(lessons.map(item => item.id))
    expect(index.problems).toEqual(problemIndex.map(item => [item.id, item.title, item.pattern]))
    expect(index.sql).toEqual(sqlProblemIndex.map(item => [item.id, item.title, item.topic]))
    expect(index.cases).toEqual(caseIndex.map(item => [item.id, item.title]))
    expect(index.guides).toEqual(guideIndex.map(item => [item.id, item.title, item.topic, item.kind]))
    expect(index.patterns).toEqual(patternIndex.map(item => [item.id, item.title, item.parent ?? '']))
    expect(index.companies.map(([id]) => id)).toEqual(companyIds)
    expect(index.decks.map(([track]) => track)).toEqual(tracks.map(item => item.id))
    expect(index.antipatterns.length).toBe(guideIndex.reduce((sum, item) => sum + item.antipatterns, 0))
    for (const [guide, title] of index.antipatterns) {
      expect(guideIds.has(guide), guide).toBe(true)
      expect(title.length).toBeGreaterThan(0)
    }
  })
})

describe('buildNavTree', () => {
  const tree = full(emptyProgress())

  it('has the five goal groups in order, each with its sections', () => {
    expect(tree.map(node => node.label)).toEqual(GROUPS.map(group => group.label))
    expect(tree.map(node => node.children!.map(child => child.label))).toEqual([
      ['Tracks', 'Patterns', 'Field Guide'],
      ['Coding problems', 'SQL problems', 'Flashcards'],
      ['Design cases', 'Whiteboard'],
      ['Company prep', 'Mock interviews', 'Story bank'],
      ['Today', 'Plan', 'Progress', 'Settings', 'Site map'],
    ])
    expect(tree.find(node => node.id === 'practise')!.href).toBe('#practice')
  })

  it('reaches item level: patterns and sub-patterns, problems by pattern, SQL by topic, guides by topic, cases, companies', () => {
    const graphs = find(tree, 'patterns/graphs')!
    expect(graphs.children?.length).toBeGreaterThan(0)
    expect(graphs.children!.every(child => child.href!.startsWith('#patterns/'))).toBe(true)
    const code = find(tree, 'code')!
    expect(code.children!.map(child => child.label)).toEqual([...new Set(problemIndex.map(item => item.pattern))])
    expect(code.children!.flatMap(child => child.children!.map(item => item.href)).sort()).toEqual(problemIndex.map(item => `#code/${item.id}`).sort())
    expect(find(tree, 'sql')!.children!.flatMap(child => child.children!.map(item => item.href)).sort()).toEqual(sqlProblemIndex.map(item => `#sql/${item.id}`).sort())
    const guide = find(tree, 'guide')!
    expect(guide.children!.at(-1)).toMatchObject({ label: 'Anti-pattern gallery', href: '#antipatterns' })
    expect(guide.children!.slice(0, -1).flatMap(child => child.children!.map(item => item.href)).sort()).toEqual(guideIndex.map(item => `#guide/${item.id}`).sort())
    expect(find(tree, 'cases')!.children!.map(item => item.href)).toEqual(caseIndex.map(item => `#design/${item.id}`))
    expect(find(tree, 'company')!.children!.map(item => item.href)).toEqual(companyIds.map(id => `#company/${id}`))
    expect(find(tree, 'mock')!.children!.map(item => item.href)).toEqual(companyIds.map(id => `#mock/${id}`))
  })

  it('links only to routes the app accepts, and every node id is unique', () => {
    const hrefs = allHrefs(tree)
    for (const href of hrefs) expect(parse(href).route, href).not.toBe('unknown')
    const nodes = walk(tree)
    expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length)
    // Every top-level route except the lesson player has a place in the tree.
    for (const route of ROUTES.filter(item => item !== 'study')) expect(hrefs, route).toContain(route === 'practice' ? '#practice' : `#${route}`)
  })

  it('counts done items and marks them with done', () => {
    const progress = emptyProgress()
    const lesson = lessons[0]
    progress.records[lesson.id] = { lessonId: lesson.id } as never
    progress.solved = { [problemIndex[0].id]: { py: '2025-01-01T00:00:00.000Z' } as never }
    progress.sqlSolved = { [sqlProblemIndex[0].id]: '2025-01-01T00:00:00.000Z' }
    progress.designs = { [caseIndex[0].id]: { percent: 80, at: '2025-01-01T00:00:00.000Z' } as never }
    progress.guides = { [guideIndex[0].id]: { percent: 80, at: '2025-01-01T00:00:00.000Z' } as never }
    progress.companies = { [companyIds[0]]: [{} as never] }
    const done = full(progress, 3)
    expect(find(done, 'tracks')!.count).toEqual({ done: 1, total: lessons.length })
    expect(find(done, `tracks/${lesson.track}`)!.count!.done).toBe(1)
    expect(find(done, 'code')!.count).toEqual({ done: 1, total: problemIndex.length })
    expect(find(done, `code/${problemIndex[0].id}`)!.done).toBe(true)
    expect(find(done, `code/${problemIndex[1].id}`)!.done).toBe(false)
    expect(find(done, `code:${problemIndex[0].pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)!.count!.done).toBe(1)
    expect(find(done, 'sql')!.count).toEqual({ done: 1, total: sqlProblemIndex.length })
    expect(find(done, 'cases')!.count).toEqual({ done: 1, total: caseIndex.length })
    expect(find(done, 'guide')!.count).toEqual({ done: 1, total: guideIndex.length })
    expect(find(done, `company/${companyIds[0]}`)!.done).toBe(true)
    expect(find(done, 'practise')!.badge).toBe(3)
    expect(find(tree, 'practise')!.badge).toBeUndefined()
  })

  it('renders the top two levels before the index loads, with deep branches pending', () => {
    const shallow = buildNavTree(undefined)
    expect(shallow.map(node => node.children!.map(child => child.id))).toEqual(tree.map(node => node.children!.map(child => child.id)))
    for (const id of ['tracks', 'patterns', 'guide', 'code', 'sql', 'cases', 'company', 'mock']) {
      expect(find(shallow, id), id).toMatchObject({ pending: true })
      expect(find(shallow, id)!.children).toBeUndefined()
    }
    expect(find(shallow, 'cards')!.pending).toBeUndefined()
  })
})

describe('groupFor', () => {
  it('puts every route in one of the five groups', () => {
    const expected: Record<string, string> = {
      tracks: 'learn', study: 'learn', patterns: 'learn', guide: 'learn', antipatterns: 'learn',
      practice: 'practise', code: 'practise', sql: 'practise', cards: 'practise',
      design: 'design', board: 'design', company: 'interview', mock: 'interview', stories: 'interview',
      home: 'me', plan: 'me', progress: 'me', settings: 'me', map: 'me',
    }
    for (const route of ROUTES) expect(groupFor({ route }), route).toBe(expected[route])
    expect(groupFor({ route: 'unknown' })).toBeUndefined()
  })
})

describe('breadcrumbs, current node and auto-expansion', () => {
  const tree = full(emptyProgress())
  const labels = (hash: string, extra?: { lesson?: string }) => breadcrumbsFor(tree, parse(hash), extra).map(crumb => crumb.label)

  it('follows the tree path for every kind of page', () => {
    expect(labels('#home')).toEqual(['Me', 'Today'])
    expect(labels('#today')).toEqual(['Me', 'Today'])
    expect(labels('#practice')).toEqual(['Practise'])
    expect(labels('#review')).toEqual(['Practise'])
    expect(labels('#cards')).toEqual(['Practise', 'Flashcards'])
    expect(labels('#map')).toEqual(['Me', 'Site map'])
    const problem = problemIndex[0]
    expect(labels(`#code/${problem.id}`)).toEqual(['Practise', 'Coding problems', problem.pattern, problem.title])
    expect(labels(`#tracks/${tracks[0].id}`)).toEqual(['Learn', 'Tracks', tracks[0].title])
    const sub = patternIndex.find(item => item.parent)!
    const parent = patternIndex.find(item => item.id === sub.parent)!
    expect(labels(`#patterns/${sub.id}`)).toEqual(['Learn', 'Patterns', parent.title, sub.title])
    expect(labels('#patterns/pick')).toEqual(['Learn', 'Patterns', 'Pattern picker'])
    expect(labels('#antipatterns')).toEqual(['Learn', 'Field Guide', 'Anti-pattern gallery'])
    expect(labels(`#mock/${companyIds[0]}`)[1]).toBe('Mock interviews')
    expect(labels('#board')).toEqual(['Design', 'Whiteboard'])
    expect(labels('#board/abc')).toEqual(['Design', 'Whiteboard', 'Board'])
    expect(labels('#study', { lesson: 'Two sum' })).toEqual(['Learn', 'Tracks', 'Two sum'])
    expect(labels('#nope')).toEqual(['Not found'])
  })

  it('links every crumb that has a page and leaves group names as text', () => {
    const crumbs = breadcrumbsFor(tree, parse(`#design/${caseIndex[0].id}`))
    expect(crumbs).toEqual([{ label: 'Design' }, { label: 'Design cases', href: '#design' }, { label: caseIndex[0].title, href: `#design/${caseIndex[0].id}` }])
  })

  it('falls back to the section until the nav index loads', () => {
    const shallow = buildNavTree(undefined)
    expect(breadcrumbsFor(shallow, parse(`#code/${problemIndex[0].id}`)).map(crumb => crumb.label)).toEqual(['Practise', 'Coding problems'])
    expect(currentNode(shallow, parse(`#code/${problemIndex[0].id}`))).toBeUndefined()
  })

  it('marks the current node and expands its ancestors', () => {
    const sub = patternIndex.find(item => item.parent)!
    expect(currentNode(tree, parse(`#patterns/${sub.id}`))?.id).toBe(`patterns/${sub.id}`)
    expect(expandedFor(tree, parse(`#patterns/${sub.id}`))).toEqual(['learn', 'patterns', `patterns/${sub.parent}`])
    expect(currentNode(tree, parse('#review'))?.id).toBe('practise')
    expect(currentNode(tree, parse('#board/abc'))).toBeUndefined()
    expect(currentNode(tree, parse('#study'))).toBeUndefined()
    expect(expandedFor(tree, parse('#nope'))).toEqual([])
    expect(pathTo(tree, '#missing')).toEqual([])
  })
})
