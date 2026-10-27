import type { Track } from './curriculum'
import type { Route } from './app-model'

export const ROUTES: readonly Route[] = ['home', 'tracks', 'practice', 'progress', 'settings', 'study', 'code', 'design', 'board', 'cards', 'mock', 'stories', 'plan', 'guide', 'antipatterns', 'sql', 'patterns', 'company']
/** Hashes from earlier releases keep working as bookmarks. */
export const ALIASES: Readonly<Record<string, Route>> = { today: 'home', roadmap: 'tracks', review: 'practice' }
/** Pattern course views other than a page id. */
export const PATTERN_VIEWS: ReadonlySet<string> = new Set(['pick', 'cheatsheet'])
/** Same as BOARD_ID in boards.ts, repeated so board storage stays out of the main bundle. */
export const BOARD_ID = /^[a-z0-9-]{1,64}$/

export interface ParsedRoute {
  route: Route | 'unknown'
  track?: Track
  problemId?: string
  caseId?: string
  guideId?: string
  sqlId?: string
  patternView?: string
  boardId?: string
  companyId?: string
}

/** The ids each sub-route accepts. Passed in so this module stays free of content imports. */
export interface RouteIds {
  tracks: readonly string[]
  problems: ReadonlySet<string>
  sql: ReadonlySet<string>
  cases: ReadonlySet<string>
  guides: ReadonlySet<string>
  patterns: ReadonlySet<string>
  companies: readonly string[]
}

/** Parses a location hash (with or without the leading '#') into a route and its sub-id. */
export function parseHash(hash: string, ids: RouteIds): ParsedRoute {
  const [head, sub, ...rest] = hash.replace(/^#/, '').split('/')
  const route = ALIASES[head || 'home'] ?? (ROUTES as string[]).find(item => item === (head || 'home')) as Route | undefined
  if (!route || rest.length) return { route: 'unknown' }
  if (sub === undefined) return { route }
  if (route === 'code') return ids.problems.has(sub) ? { route, problemId: sub } : { route: 'unknown' }
  if (route === 'sql') return ids.sql.has(sub) ? { route, sqlId: sub } : { route: 'unknown' }
  if (route === 'design') return ids.cases.has(sub) ? { route, caseId: sub } : { route: 'unknown' }
  if (route === 'company' || route === 'mock') return ids.companies.includes(sub) ? { route, companyId: sub } : { route: 'unknown' }
  if (route === 'board') return BOARD_ID.test(sub) ? { route, boardId: sub } : { route: 'unknown' }
  if (route === 'guide') return ids.guides.has(sub) ? { route, guideId: sub } : { route: 'unknown' }
  if (route === 'patterns') return ids.patterns.has(sub) || PATTERN_VIEWS.has(sub) ? { route, patternView: sub } : { route: 'unknown' }
  const track = ids.tracks.find(item => item === sub) as Track | undefined
  return route === 'tracks' && track ? { route, track } : { route: 'unknown' }
}

/** The canonical hash for a parsed route: aliases resolve to their target, sub-ids are kept. */
export function hrefFor(parsed: ParsedRoute): string {
  if (parsed.route === 'unknown') return ''
  const sub = parsed.track ?? parsed.problemId ?? parsed.sqlId ?? parsed.caseId ?? parsed.companyId ?? parsed.boardId ?? parsed.guideId ?? parsed.patternView
  return `#${parsed.route}${sub ? `/${sub}` : ''}`
}
