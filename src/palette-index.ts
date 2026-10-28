import { fuzzyScore } from './fuzzy'
import type { NavIndex } from './nav-model'

export type PaletteKind = 'page' | 'track' | 'lesson' | 'pattern' | 'guide' | 'antipattern' | 'problem' | 'sql' | 'deck' | 'case' | 'company' | 'snippet'

export interface PaletteEntry {
  /** Unique: used for the option's DOM id and for recents. */
  id: string
  kind: PaletteKind
  title: string
  href: string
  /** Shown under the title, e.g. the pattern a problem belongs to. Also searched, at a lower weight. */
  detail?: string
  /** Extra words that should find this entry but are not shown. */
  keywords?: string
}

export interface PaletteGroup { kind: PaletteKind | 'recent' | 'suggested'; label: string; items: PaletteEntry[]; more: number }

export const KIND_LABELS: Record<PaletteKind, string> = {
  page: 'Pages', track: 'Tracks', lesson: 'Lessons', pattern: 'Patterns', guide: 'Field Guide', antipattern: 'Anti-patterns',
  problem: 'Coding problems', sql: 'SQL problems', deck: 'Flashcard decks', case: 'Design cases', company: 'Companies', snippet: 'Playground snippets',
}
const KIND_ORDER = Object.keys(KIND_LABELS) as PaletteKind[]

/** The fixed pages and hubs, with the words people might type to find them. */
export const PAGES: readonly PaletteEntry[] = [
  ['home', 'Today', '#home', 'home dashboard daily start'],
  ['plan', 'Plan', '#plan', 'study plan schedule interview date'],
  ['progress', 'Progress', '#progress', 'stats xp streak badges'],
  ['settings', 'Settings', '#settings', 'preferences theme dark mode accent font editor'],
  ['backup', 'Export or import a backup', '#settings', 'backup restore export import save data'],
  ['map', 'Site map', '#map', 'sitemap overview everything all pages tree'],
  ['practice', 'Practise hub', '#practice', 'practice review drills'],
  ['tracks', 'Tracks', '#tracks', 'roadmap curriculum lessons courses'],
  ['patterns', 'Patterns', '#patterns', 'algorithm patterns course'],
  ['pick', 'Pattern picker', '#patterns/pick', 'which pattern quiz'],
  ['cheatsheet', 'Cheat sheet', '#patterns/cheatsheet', 'patterns summary reference'],
  ['guide', 'Field Guide', '#guide', 'guides articles'],
  ['antipatterns', 'Anti-pattern gallery', '#antipatterns', 'bad better mistakes'],
  ['code', 'Coding problems', '#code', 'leetcode exercises algorithms'],
  ['sql', 'SQL problems', '#sql', 'queries database postgres'],
  ['cards', 'Flashcards', '#cards', 'spaced repetition decks review'],
  ['playground', 'Playground', '#playground', 'codepad scratchpad repl sandbox run code javascript typescript python sql snippets'],
  ['design', 'Design cases', '#design', 'system design'],
  ['board', 'Whiteboard', '#board', 'draw diagram excalidraw sketch'],
  ['company', 'Company prep', '#company', 'employers companies'],
  ['mock', 'Mock interviews', '#mock', 'practice interview timer loop'],
  ['stories', 'Story bank', '#stories', 'behavioural behavioral star stories'],
].map(([id, title, href, keywords]) => ({ id: `page:${id}`, kind: 'page' as const, title, href, keywords }))

/** Shown before anything is typed. */
export const SUGGESTED = ['page:home', 'page:code', 'page:patterns', 'page:guide', 'page:design', 'page:map']

export interface LessonInfo { id: string; title: string; track: string }

/** Every searchable destination, from the lazy nav index plus the lesson titles. */
export function buildPaletteIndex(nav: NavIndex, lessons: readonly LessonInfo[] = []): PaletteEntry[] {
  const trackTitle = new Map(nav.tracks.map(([id, title]) => [id, title]))
  const patternTitle = new Map(nav.patterns.map(([id, title]) => [id, title]))
  const guideTitle = new Map(nav.guides.map(([id, title]) => [id, title]))
  return [
    ...PAGES,
    ...nav.tracks.map(([id, title, items]): PaletteEntry => ({ id: `track:${id}`, kind: 'track', title, href: `#tracks/${id}`, detail: `${items.length} lessons` })),
    ...lessons.map((lesson): PaletteEntry => ({ id: `lesson:${lesson.id}`, kind: 'lesson', title: lesson.title, href: `#tracks/${lesson.track}`, detail: trackTitle.get(lesson.track) })),
    ...nav.patterns.map(([id, title, parent]): PaletteEntry => ({ id: `pattern:${id}`, kind: 'pattern', title, href: `#patterns/${id}`, ...(parent ? { detail: patternTitle.get(parent) } : {}) })),
    ...nav.guides.map(([id, title, , kind]): PaletteEntry => ({ id: `guide:${id}`, kind: 'guide', title, href: `#guide/${id}`, detail: kind === 'case' ? 'Case study' : 'Guide' })),
    ...nav.antipatterns.map(([guide, title], index): PaletteEntry => ({ id: `antipattern:${index}`, kind: 'antipattern', title, href: `#guide/${guide}`, detail: guideTitle.get(guide) })),
    ...nav.problems.map(([id, title, pattern]): PaletteEntry => ({ id: `problem:${id}`, kind: 'problem', title, href: `#code/${id}`, detail: pattern })),
    ...nav.sql.map(([id, title, topic]): PaletteEntry => ({ id: `sql:${id}`, kind: 'sql', title, href: `#sql/${id}`, detail: topic })),
    ...nav.decks.map(([track, title, cards]): PaletteEntry => ({ id: `deck:${track}`, kind: 'deck', title, href: '#cards', detail: `${cards} cards`, keywords: 'flashcards' })),
    ...nav.cases.map(([id, title]): PaletteEntry => ({ id: `case:${id}`, kind: 'case', title, href: `#design/${id}`, keywords: 'system design' })),
    ...nav.companies.flatMap(([id, name]): PaletteEntry[] => [
      { id: `company:${id}`, kind: 'company', title: name, href: `#company/${id}`, detail: 'Company prep' },
      { id: `mock:${id}`, kind: 'company', title: `${name} mock loop`, href: `#mock/${id}`, detail: 'Mock interview' },
    ]),
  ]
}

const SNIPPET_LANG_LABELS: Record<string, string> = { js: 'JavaScript', ts: 'TypeScript', py: 'Python', sql: 'SQL' }

/** The Playground snippets saved on this device, as palette entries. */
export function snippetEntries(snippets: readonly { id: string; name: string; lang: string }[]): PaletteEntry[] {
  return snippets.map(snippet => ({ id: `snippet:${snippet.id}`, kind: 'snippet', title: snippet.name, href: `#playground/${snippet.id}`, detail: `${SNIPPET_LANG_LABELS[snippet.lang] ?? snippet.lang} snippet`, keywords: 'playground' }))
}

/** An entry's score: its title counts fully, its detail and keywords at a discount. */
export function scoreEntry(query: string, entry: PaletteEntry): number | null {
  const title = fuzzyScore(query, entry.title)
  const extra = entry.detail || entry.keywords ? fuzzyScore(query, `${entry.title} ${entry.detail ?? ''} ${entry.keywords ?? ''}`) : null
  if (title === null && extra === null) return null
  return Math.max(title ?? -Infinity, extra === null ? -Infinity : extra * 0.85)
}

/**
 * Search results grouped by kind, best group first, each capped at `perGroup` items.
 * An empty query gives recent destinations then suggestions.
 */
export function searchPalette(entries: readonly PaletteEntry[], query: string, options: { perGroup?: number; recent?: readonly string[] } = {}): PaletteGroup[] {
  const perGroup = options.perGroup ?? 5
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  if (!query.trim()) {
    const recent = (options.recent ?? []).map(id => byId.get(id)).filter((entry): entry is PaletteEntry => !!entry).slice(0, perGroup)
    const seen = new Set(recent.map(entry => entry.id))
    const suggested = SUGGESTED.filter(id => !seen.has(id)).map(id => byId.get(id)).filter((entry): entry is PaletteEntry => !!entry)
    return [
      ...(recent.length ? [{ kind: 'recent' as const, label: 'Recent', items: recent, more: 0 }] : []),
      { kind: 'suggested' as const, label: 'Suggested', items: suggested, more: 0 },
    ]
  }
  const scored = new Map<PaletteKind, { entry: PaletteEntry; score: number }[]>()
  for (const entry of entries) {
    const score = scoreEntry(query, entry)
    if (score === null) continue
    const list = scored.get(entry.kind) ?? []
    list.push({ entry, score })
    scored.set(entry.kind, list)
  }
  return [...scored.entries()]
    .map(([kind, list]) => {
      list.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      return { kind, label: KIND_LABELS[kind], items: list.slice(0, perGroup).map(item => item.entry), more: Math.max(0, list.length - perGroup), best: list[0].score }
    })
    .sort((a, b) => b.best - a.best || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map(group => ({ kind: group.kind, label: group.label, items: group.items, more: group.more }))
}
