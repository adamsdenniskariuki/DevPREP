import type { Progress } from './progress'
import type { ParsedRoute } from './routes'
import { hrefFor } from './routes'

export type GroupId = 'learn' | 'practise' | 'design' | 'interview' | 'me'

export interface NavNode {
  /** Unique and stable: expanded state is saved by id. */
  id: string
  label: string
  href?: string
  icon?: string
  /** Items finished out of the items below this node. */
  count?: { done: number; total: number }
  done?: boolean
  /** Lessons due for review, shown on the Practise group. */
  badge?: number
  children?: NavNode[]
  /** The children come from the lazy nav index, which has not loaded yet. */
  pending?: boolean
}

/** Built by scripts/build-content.mjs as src/generated/nav-index.json. Tuples keep it small. */
export interface NavIndex {
  tracks: [id: string, title: string, lessons: string[]][]
  patterns: [id: string, title: string, parent: string][]
  problems: [id: string, title: string, pattern: string][]
  sql: [id: string, title: string, topic: string][]
  guides: [id: string, title: string, topic: string, kind: string][]
  cases: [id: string, title: string][]
  companies: [id: string, name: string][]
  decks: [track: string, title: string, cards: number][]
  /** Anti-pattern titles with the guide they appear in, for the command palette. */
  antipatterns: [guide: string, title: string][]
}

export type NavProgress = Pick<Progress, 'records' | 'solved' | 'sqlSolved' | 'designs' | 'guides' | 'patterns' | 'companies' | 'companyMocks'>

export interface Crumb { label: string; href?: string }

/** Children and counts for the sections whose items live in the nav index, keyed by section id. */
export type DeepSections = Partial<Record<string, { children: NavNode[]; count?: NavNode['count'] }>>

/** The lazy half of the nav: the index and the code that turns it into deep tree levels. */
export interface NavData {
  index: NavIndex
  deepSections: (progress: NavProgress, index: NavIndex) => DeepSections
}

let dataCache: Promise<NavData> | undefined
/** Loads the nav index chunk once. */
export function loadNavData(): Promise<NavData> {
  dataCache ??= Promise.all([import('./generated/nav-index.json'), import('./nav-deep')])
    .then(([json, deep]) => ({ index: json.default as unknown as NavIndex, deepSections: deep.deepSections }))
  dataCache.catch(() => { dataCache = undefined })
  return dataCache
}

export const GROUPS: readonly { id: GroupId; label: string; icon: string; href?: string }[] = [
  { id: 'learn', label: 'Learn', icon: 'book' },
  { id: 'practise', label: 'Practise', icon: 'repeat', href: '#practice' },
  { id: 'design', label: 'Design', icon: 'layers' },
  { id: 'interview', label: 'Interview', icon: 'target' },
  { id: 'me', label: 'Me', icon: 'home' },
]

const ROUTE_GROUP: Record<string, GroupId> = {
  tracks: 'learn', study: 'learn', patterns: 'learn', guide: 'learn', antipatterns: 'learn',
  practice: 'practise', code: 'practise', sql: 'practise', cards: 'practise', playground: 'practise',
  design: 'design', board: 'design',
  company: 'interview', mock: 'interview', stories: 'interview',
  home: 'me', plan: 'me', progress: 'me', settings: 'me', map: 'me', changelog: 'me',
}

/** The nav group a route belongs to, or undefined for an unknown page. */
export function groupFor(parsed: Pick<ParsedRoute, 'route'>): GroupId | undefined {
  return ROUTE_GROUP[parsed.route]
}

/**
 * The whole navigation tree. Without the deep sections only the top two levels are known;
 * nodes whose children live in the nav index are marked pending.
 */
export function buildNavTree(deep: DeepSections | undefined, due = 0): NavNode[] {
  const branch = (node: NavNode): NavNode => {
    const section = deep?.[node.id]
    return section ? { ...node, children: section.children, ...(section.count ? { count: section.count } : {}) } : { ...node, pending: true }
  }
  const group = (id: GroupId, children: NavNode[]): NavNode => {
    const info = GROUPS.find(item => item.id === id)!
    return { id, label: info.label, icon: info.icon, ...(info.href ? { href: info.href } : {}), children }
  }

  return [
    group('learn', [
      branch({ id: 'tracks', label: 'Tracks', href: '#tracks' }),
      branch({ id: 'patterns', label: 'Patterns', href: '#patterns' }),
      branch({ id: 'guide', label: 'Field Guide', href: '#guide' }),
    ]),
    { ...group('practise', [
      branch({ id: 'code', label: 'Coding problems', href: '#code' }),
      branch({ id: 'sql', label: 'SQL problems', href: '#sql' }),
      { id: 'cards', label: 'Flashcards', href: '#cards' },
      { id: 'playground', label: 'Playground', href: '#playground' },
    ]), ...(due > 0 ? { badge: due } : {}) },
    group('design', [
      branch({ id: 'cases', label: 'Design cases', href: '#design' }),
      { id: 'board', label: 'Whiteboard', href: '#board' },
    ]),
    group('interview', [
      branch({ id: 'company', label: 'Company prep', href: '#company' }),
      branch({ id: 'mock', label: 'Mock interviews', href: '#mock' }),
      { id: 'stories', label: 'Story bank', href: '#stories' },
    ]),
    group('me', [
      { id: 'home', label: 'Today', href: '#home' },
      { id: 'plan', label: 'Plan', href: '#plan' },
      { id: 'progress', label: 'Progress', href: '#progress' },
      { id: 'settings', label: 'Settings', href: '#settings' },
      { id: 'changelog', label: 'What’s new', href: '#changelog' },
      { id: 'map', label: 'Site map', href: '#map' },
    ]),
  ]
}

/** The chain of nodes from a top-level group down to the node with this href, or [] when none matches. */
export function pathTo(tree: readonly NavNode[], href: string): NavNode[] {
  for (const node of tree) {
    if (node.href === href && !node.children?.some(child => child.href === href)) return [node]
    const below = node.children ? pathTo(node.children, href) : []
    if (below.length) return [node, ...below]
  }
  return []
}

/** The node ids to expand so the current page is visible. */
export function expandedFor(tree: readonly NavNode[], parsed: ParsedRoute): string[] {
  return nodePath(tree, parsed).slice(0, -1).map(node => node.id)
}

function nodePath(tree: readonly NavNode[], parsed: ParsedRoute): NavNode[] {
  if (parsed.route === 'unknown') return []
  if (parsed.route === 'study') return pathTo(tree, '#tracks')
  if (parsed.route === 'board') return pathTo(tree, '#board')
  if (parsed.route === 'playground') return pathTo(tree, '#playground')
  const exact = pathTo(tree, hrefFor(parsed))
  // Deep items are missing until the nav index loads, so fall back to their section.
  return exact.length ? exact : pathTo(tree, `#${parsed.route}`)
}

/** The node for the current page, used to mark it aria-current in the tree. */
export function currentNode(tree: readonly NavNode[], parsed: ParsedRoute): NavNode | undefined {
  if (parsed.route === 'study' || (parsed.route === 'board' && parsed.boardId) || (parsed.route === 'playground' && parsed.snippetId)) return undefined
  const path = nodePath(tree, parsed)
  const node = path[path.length - 1]
  return node && node.href === hrefFor(parsed) ? node : undefined
}

/**
 * Breadcrumbs for a page: the tree path to it, with group nodes that have no page as plain text.
 * A lesson in progress and a single whiteboard get one extra crumb below their section.
 */
export function breadcrumbsFor(tree: readonly NavNode[], parsed: ParsedRoute, extra?: { lesson?: string }): Crumb[] {
  if (parsed.route === 'unknown') return [{ label: 'Not found' }]
  const crumbs: Crumb[] = nodePath(tree, parsed).map(node => ({ label: node.label, ...(node.href ? { href: node.href } : {}) }))
  if (parsed.route === 'study') crumbs.push({ label: extra?.lesson ?? 'Lesson' })
  if (parsed.route === 'board' && parsed.boardId) crumbs.push({ label: 'Board' })
  if (parsed.route === 'playground' && parsed.snippetId) crumbs.push({ label: 'Snippet' })
  return crumbs
}

/** Every href in the tree, for tests and the site map. */
export function allHrefs(tree: readonly NavNode[]): string[] {
  return tree.flatMap(node => [...(node.href ? [node.href] : []), ...(node.children ? allHrefs(node.children) : [])])
}
