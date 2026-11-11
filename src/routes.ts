import type { Track } from './curriculum'
import type { Route } from './app-model'

export const ROUTES: readonly Route[] = ['home', 'tracks', 'practice', 'progress', 'settings', 'study', 'code', 'design', 'board', 'cards', 'mock', 'stories', 'plan', 'guide', 'antipatterns', 'sql', 'patterns', 'company', 'map', 'playground', 'changelog', 'plans', 'codebase', 'react', 'skilltest']
/** Hashes from earlier releases keep working as bookmarks. */
export const ALIASES: Readonly<Record<string, Route>> = { today: 'home', roadmap: 'tracks', review: 'practice' }
/** Pattern course views other than a page id. */
export const PATTERN_VIEWS: ReadonlySet<string> = new Set(['pick', 'cheatsheet'])
/** Same as BOARD_ID in boards.ts, repeated so board storage stays out of the main bundle. */
export const BOARD_ID = /^[a-z0-9-]{1,64}$/
/** Optional language suffix on a code problem link (#code/<id>/<lang>), used by study plans. */
const CODE_LANGS = ['js', 'py', 'ts']

export interface ParsedRoute {
  route: Route | 'unknown'
  track?: Track
  problemId?: string
  /** Opens the problem in this language; the canonical href leaves it out. */
  codeLang?: 'js' | 'py' | 'ts'
  caseId?: string
  guideId?: string
  sqlId?: string
  patternView?: string
  boardId?: string
  companyId?: string
  snippetId?: string
  planId?: string
  /** A math lab inside a study plan (#plans/<plan>/<lab>). The screen reports an unknown lab. */
  labId?: string
  /** A codebase practice task, as "repo/task" (#codebase/<repo>/<task>). */
  codebaseTask?: string
  /** A React lesson or exercise (#react/<id>). */
  reactId?: string
  /** A timed skill test (#skilltest/<id>). */
  skillTestId?: string
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
  /** Study plan ids. Without them any well-formed id parses, and the screen reports an unknown plan. */
  plans?: ReadonlySet<string>
  /** Codebase practice tasks as "repo/task". Without them any well-formed pair parses, and the screen reports an unknown task. */
  codebase?: ReadonlySet<string>
  /** React lesson and exercise ids. Without them any well-formed id parses, and the screen reports an unknown item. */
  react?: ReadonlySet<string>
  /** Skill test ids, with the same fallback. */
  skillTests?: ReadonlySet<string>
}

/** Parses a location hash (with or without the leading '#') into a route and its sub-id. */
export function parseHash(hash: string, ids: RouteIds): ParsedRoute {
  const [head, sub, ...rest] = hash.replace(/^#/, '').split('/')
  const route = ALIASES[head || 'home'] ?? (ROUTES as string[]).find(item => item === (head || 'home')) as Route | undefined
  if (!route || rest.length > (route === 'code' || route === 'plans' || route === 'codebase' ? 1 : 0)) return { route: 'unknown' }
  if (sub === undefined) return { route }
  if (route === 'code') return ids.problems.has(sub) && (!rest.length || CODE_LANGS.includes(rest[0])) ? { route, problemId: sub, codeLang: rest[0] as ParsedRoute['codeLang'] } : { route: 'unknown' }
  if (route === 'sql') return ids.sql.has(sub) ? { route, sqlId: sub } : { route: 'unknown' }
  if (route === 'design') return ids.cases.has(sub) ? { route, caseId: sub } : { route: 'unknown' }
  if (route === 'company' || route === 'mock') return ids.companies.includes(sub) ? { route, companyId: sub } : { route: 'unknown' }
  if (route === 'board') return BOARD_ID.test(sub) ? { route, boardId: sub } : { route: 'unknown' }
  if (route === 'playground') return BOARD_ID.test(sub) ? { route, snippetId: sub } : { route: 'unknown' }
  if (route === 'plans') return (ids.plans ? ids.plans.has(sub) : BOARD_ID.test(sub)) && (!rest.length || BOARD_ID.test(rest[0])) ? { route, planId: sub, ...rest.length ? { labId: rest[0] } : {} } : { route: 'unknown' }
  if (route === 'codebase') {
    const task = `${sub}/${rest[0]}`
    return rest.length && (ids.codebase ? ids.codebase.has(task) : BOARD_ID.test(sub) && BOARD_ID.test(rest[0])) ? { route, codebaseTask: task } : { route: 'unknown' }
  }
  if (route === 'react') return (ids.react ? ids.react.has(sub) : BOARD_ID.test(sub)) ? { route, reactId: sub } : { route: 'unknown' }
  if (route === 'skilltest') return (ids.skillTests ? ids.skillTests.has(sub) : BOARD_ID.test(sub)) ? { route, skillTestId: sub } : { route: 'unknown' }
  if (route === 'guide') return ids.guides.has(sub) ? { route, guideId: sub } : { route: 'unknown' }
  if (route === 'patterns') return ids.patterns.has(sub) || PATTERN_VIEWS.has(sub) ? { route, patternView: sub } : { route: 'unknown' }
  const track = ids.tracks.find(item => item === sub) as Track | undefined
  return route === 'tracks' && track ? { route, track } : { route: 'unknown' }
}

/** The canonical hash for a parsed route: aliases resolve to their target, sub-ids are kept. */
export function hrefFor(parsed: ParsedRoute): string {
  if (parsed.route === 'unknown') return ''
  const sub = parsed.track ?? parsed.problemId ?? parsed.sqlId ?? parsed.caseId ?? parsed.companyId ?? parsed.boardId ?? parsed.snippetId ?? parsed.planId ?? parsed.guideId ?? parsed.patternView ?? parsed.codebaseTask ?? parsed.reactId ?? parsed.skillTestId
  return `#${parsed.route}${sub ? `/${sub}` : ''}${parsed.planId && parsed.labId ? `/${parsed.labId}` : ''}`
}
