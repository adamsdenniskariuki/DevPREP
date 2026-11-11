import planIds from './generated/plan-ids.json' with { type: 'json' }

/** Study plan content, built from content/plans by scripts/build-content.mjs. */
/** Text written once per interview language the plan offers. */
export type PerLanguage<T> = Partial<Record<PlanLanguage, T>>
export interface PlanItem { id: string; text: string | PerLanguage<string>; minutes: number; href?: string; lesson?: string }
export interface PlanDay { title: string; items: PlanItem[] }
/** `tip` is a language-specific idiom for the week's patterns. */
export interface PlanWeek { n: number; phase: string; title: string; focus: string; track?: string; tip?: PerLanguage<string>; days: PlanDay[] }
export interface PlanTrack { id: string; title: string; summary: string }
export interface PlanPhase { id: string; title: string; weeks: [first: number, last: number]; check: string }
export interface StudyPlan {
  id: string
  title: string
  summary: string
  hoursPerWeek: string
  languages: PlanLanguage[]
  rhythm: { when: string; time: string; text: string }[]
  rules: string[]
  /** Interview idioms for each language, and a link to brush up on it. */
  tips: PerLanguage<string[]>
  refresher: PerLanguage<string>
  tracks: PlanTrack[]
  phases: PlanPhase[]
  weeks: PlanWeek[]
}

/** Interview languages a plan can be followed in. Add an entry here (and in build-content PLAN_LANGUAGES) to offer another. */
export const PLAN_LANGUAGES = [{ id: 'python', label: 'Python', code: 'py' }, { id: 'typescript', label: 'TypeScript', code: 'ts' }] as const
export type PlanLanguage = typeof PLAN_LANGUAGES[number]['id']
/** The chosen language, or Python when none (or an unknown one) is set. */
export const planLanguage = (id: string | undefined) => PLAN_LANGUAGES.find(lang => lang.id === id) ?? PLAN_LANGUAGES[0]
export const languageLabel = (id: string | undefined) => planLanguage(id).label
/** Per-language content for the chosen language, falling back to the default language. */
export const forLanguage = <T>(value: PerLanguage<T> | undefined, lang: string | undefined): T | undefined => value?.[planLanguage(lang).id] ?? value?.[PLAN_LANGUAGES[0].id]
/** Code problem links open in the plan's language (#code/<id>/<lang>); other links are unchanged. */
export const planHref = (href: string, lang: string | undefined) => /^#code\/[a-z0-9-]+$/.test(href) ? `${href}/${planLanguage(lang).code}` : href

export const PLAN_IDS: ReadonlySet<string> = new Set(planIds)

let cache: Promise<StudyPlan[]> | undefined
/** Loads every plan once, in a lazy chunk. */
export function loadPlans(): Promise<StudyPlan[]> {
  cache ??= import('./generated/plans.json').then(json => json.default as unknown as StudyPlan[])
  cache.catch(() => { cache = undefined })
  return cache
}

/* ---------- Dates ---------- */

const DAY = /^\d{4}-\d{2}-\d{2}$/
/** A local calendar day as YYYY-MM-DD. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
const utc = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) }
/** Whole calendar days from `start` to `today` (both YYYY-MM-DD), unaffected by daylight-saving changes. */
export function daysBetween(start: string, today: string): number {
  return Math.round((utc(today) - utc(start)) / 86_400_000)
}

export type PlanPosition =
  | { status: 'upcoming'; daysUntil: number }
  | { status: 'active'; week: number; day: number }
  | { status: 'finished' }

/** Where today falls in a plan of `weeks` weeks that started on `start`. Day 1 of week 1 is the start date. */
export function positionFor(start: string, today: string, weeks: number): PlanPosition {
  const index = daysBetween(start, today)
  if (index < 0) return { status: 'upcoming', daysUntil: -index }
  if (index >= weeks * 7) return { status: 'finished' }
  return { status: 'active', week: Math.floor(index / 7) + 1, day: index % 7 + 1 }
}

/* ---------- Plan helpers ---------- */

export const weekCount = (plan: StudyPlan) => Math.max(...plan.weeks.map(week => week.n))
export const defaultTrack = (plan: StudyPlan) => plan.tracks[0]?.id ?? ''
/** The weeks a learner follows: shared weeks plus the chosen track's version of the switchable ones. */
export function weeksFor(plan: StudyPlan, track: string | undefined): PlanWeek[] {
  const chosen = plan.tracks.some(item => item.id === track) ? track : defaultTrack(plan)
  return plan.weeks.filter(week => !week.track || week.track === chosen).sort((a, b) => a.n - b.n)
}
export const weekItems = (week: PlanWeek) => week.days.flatMap(day => day.items)
export const phaseOf = (plan: StudyPlan, n: number) => plan.phases.find(phase => n >= phase.weeks[0] && n <= phase.weeks[1])
/** Items done out of the items in the chosen track. */
export function planCount(plan: StudyPlan, progress: PlanProgress | undefined): { done: number; total: number } {
  const items = weeksFor(plan, progress?.track).flatMap(weekItems)
  return { done: items.filter(item => progress?.done[item.id]).length, total: items.length }
}
/** Replaces the {lang} placeholder with the chosen interview language. */
export const itemText = (item: PlanItem, lang: string | undefined) => (typeof item.text === 'string' ? item.text : forLanguage(item.text, lang) ?? '').replaceAll('{lang}', languageLabel(lang))

/* ---------- Local progress ---------- */

/** Plan progress lives in its own localStorage key, apart from study progress, and rides along in backups as "plans". */
export const PLANS_KEY = 'devprep.plans.v1'
export const MAX_PLANS_BYTES = 500_000
export const MAX_ERRORS = 300
export const MAX_SCORES = 100
export const MAX_FIELD = 300
export const MAX_NOTES = 1_000
const MAX_DONE = 2_000
export const ENTRY_ID = /^[a-z0-9-]{1,64}$/

export type CheckResult = 'pass' | 'fail'
/** One miss: what you were solving, the pattern it needed, why you missed it and what you will do differently. */
export interface ErrorEntry { id: string; at: string; problem: string; pattern: string; why: string; fix: string }
/** 'codebase' was added in 1.14; older backups simply have no scorecards of that kind. */
export type ScoreKind = 'dsa' | 'design' | 'case' | 'codebase'
export const SCORE_AREAS: Record<ScoreKind, readonly [string, string, string, string]> = {
  dsa: ['Communication', 'Correctness', 'Complexity', 'Testing'],
  design: ['Requirements', 'Design', 'Depth', 'Trade-offs'],
  case: ['Problem framing', 'Decomposition', 'Technical depth', 'Communication'],
  codebase: ['Orientation', 'Debugging', 'Code change', 'Communication'],
}
export const SCORE_KIND_LABELS: Record<ScoreKind, string> = { dsa: 'Coding', design: 'System design', case: 'Customer case', codebase: 'Codebase' }
/** A mock interview scorecard, each area scored 1–4. */
export interface Scorecard { id: string; at: string; kind: ScoreKind; title: string; scores: [number, number, number, number]; notes: string }
export interface PlanProgress {
  /** The local day the plan started, YYYY-MM-DD. */
  start?: string
  track?: string
  lang?: PlanLanguage
  /** Item id → the local day it was ticked. */
  done: Record<string, string>
  checks: Record<string, CheckResult>
  errors: ErrorEntry[]
  scores: Scorecard[]
}
export type PlansState = Record<string, PlanProgress>

export const emptyPlanProgress = (): PlanProgress => ({ done: {}, checks: {}, errors: [], scores: [] })
export const scoreAverage = (card: Scorecard) => card.scores.reduce((sum, score) => sum + score, 0) / card.scores.length

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const field = (value: unknown, max: number, what: string, required = true): string => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid(`${what} must be ${required ? '1–' : 'at most '}${max} characters.`)
  return value
}
const only = (value: Record<string, unknown>, keys: readonly string[], what: string) => {
  if (Object.keys(value).some(key => !keys.includes(key))) invalid(`${what} has unexpected fields.`)
}

function parseError(value: unknown): ErrorEntry {
  if (!isRec(value)) invalid('an error-log entry is not an object.')
  only(value, ['id', 'at', 'problem', 'pattern', 'why', 'fix'], 'an error-log entry')
  if (typeof value.id !== 'string' || !ENTRY_ID.test(value.id)) invalid('an error-log entry has an invalid id.')
  if (!isDay(value.at)) invalid('an error-log entry has an invalid date.')
  return {
    id: value.id, at: value.at, problem: field(value.problem, MAX_FIELD, 'an error-log problem'), pattern: field(value.pattern, MAX_FIELD, 'an error-log pattern', false),
    why: field(value.why, MAX_FIELD, 'an error-log reason', false), fix: field(value.fix, MAX_FIELD, 'an error-log fix', false),
  }
}

function parseScore(value: unknown): Scorecard {
  if (!isRec(value)) invalid('a scorecard is not an object.')
  only(value, ['id', 'at', 'kind', 'title', 'scores', 'notes'], 'a scorecard')
  if (typeof value.id !== 'string' || !ENTRY_ID.test(value.id)) invalid('a scorecard has an invalid id.')
  if (!isDay(value.at)) invalid('a scorecard has an invalid date.')
  if (typeof value.kind !== 'string' || !Object.keys(SCORE_AREAS).includes(value.kind)) invalid('a scorecard has an unknown kind.')
  if (!Array.isArray(value.scores) || value.scores.length !== 4 || value.scores.some(score => !Number.isInteger(score) || score < 1 || score > 4)) invalid('scorecard scores must be four whole numbers from 1 to 4.')
  return { id: value.id, at: value.at, kind: value.kind as ScoreKind, title: field(value.title, MAX_FIELD, 'a scorecard title'), scores: value.scores as Scorecard['scores'], notes: field(value.notes ?? '', MAX_NOTES, 'scorecard notes', false) }
}

function parseOne(value: unknown, id: string): PlanProgress {
  if (!isRec(value)) invalid(`study plan ${id} is not an object.`)
  only(value, ['start', 'track', 'lang', 'done', 'checks', 'errors', 'scores'], `study plan ${id}`)
  if (value.start !== undefined && !isDay(value.start)) invalid(`study plan ${id} has an invalid start date.`)
  if (value.track !== undefined && (typeof value.track !== 'string' || !ENTRY_ID.test(value.track))) invalid(`study plan ${id} has an invalid track.`)
  if (value.lang !== undefined && !PLAN_LANGUAGES.some(lang => lang.id === value.lang)) invalid(`study plan ${id} has an unknown language.`)
  if (!isRec(value.done) || Object.keys(value.done).length > MAX_DONE) invalid(`study plan ${id} has an invalid checklist.`)
  for (const [item, day] of Object.entries(value.done)) if (!ENTRY_ID.test(item) || !isDay(day)) invalid(`study plan ${id} has an invalid checklist entry.`)
  if (!isRec(value.checks)) invalid(`study plan ${id} has invalid phase checks.`)
  for (const [phase, result] of Object.entries(value.checks)) if (!ENTRY_ID.test(phase) || (result !== 'pass' && result !== 'fail')) invalid(`study plan ${id} has an invalid phase check.`)
  if (!Array.isArray(value.errors) || value.errors.length > MAX_ERRORS) invalid(`study plan ${id} error log must be a list of at most ${MAX_ERRORS}.`)
  if (!Array.isArray(value.scores) || value.scores.length > MAX_SCORES) invalid(`study plan ${id} scorecards must be a list of at most ${MAX_SCORES}.`)
  return {
    ...value.start !== undefined ? { start: value.start as string } : {},
    ...value.track !== undefined ? { track: value.track as string } : {},
    ...value.lang !== undefined ? { lang: value.lang as PlanLanguage } : {},
    done: { ...value.done as Record<string, string> }, checks: { ...value.checks as Record<string, CheckResult> },
    errors: value.errors.map(parseError), scores: value.scores.map(parseScore),
  }
}

/** Checks study plan progress from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parsePlans(value: unknown): PlansState {
  if (!isRec(value)) invalid('study plans must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_PLANS_BYTES) invalid('study plan progress is larger than 500 KB.')
  const state: PlansState = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!PLAN_IDS.has(id)) invalid(`unknown study plan ${id}.`)
    state[id] = parseOne(entry, id)
  }
  return state
}

/** Saved plan progress, or an empty state when nothing (or nothing valid) is stored. */
export function readPlans(): PlansState {
  try {
    return parsePlans(JSON.parse(window.localStorage.getItem(PLANS_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves plan progress synchronously. False when the browser refuses (private mode or storage full). */
export function writePlans(state: PlansState): boolean {
  try {
    window.localStorage.setItem(PLANS_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/** True when any plan has been started. Cheap enough for the Home screen. */
export const anyStarted = (state: PlansState) => Object.values(state).some(entry => !!entry.start)

export function newEntryId(prefix: string, taken: readonly { id: string }[]): string {
  const ids = new Set(taken.map(item => item.id))
  for (;;) {
    const id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    if (!ids.has(id)) return id
  }
}

/* ---------- Pure updates ---------- */

export const progressFor = (state: PlansState, id: string) => state[id] ?? emptyPlanProgress()
export const withPlan = (state: PlansState, id: string, change: (entry: PlanProgress) => PlanProgress): PlansState => ({ ...state, [id]: change(progressFor(state, id)) })

export function toggleItem(entry: PlanProgress, itemId: string, today: string): PlanProgress {
  const done = { ...entry.done }
  if (done[itemId]) delete done[itemId]
  else done[itemId] = today
  return { ...entry, done }
}

/** Ticks items (keeping the day an item was first ticked), e.g. when a linked lab passes. */
export function markDone(entry: PlanProgress, itemIds: readonly string[], today: string): PlanProgress {
  const done = { ...entry.done }
  for (const id of itemIds) done[id] ??= today
  return { ...entry, done }
}

export function setCheck(entry: PlanProgress, phase: string, result: CheckResult | undefined): PlanProgress {
  const checks = { ...entry.checks }
  if (result) checks[phase] = result
  else delete checks[phase]
  return { ...entry, checks }
}

/** Adds or replaces an entry by id, newest first, and enforces the cap. */
export function upsert<T extends { id: string }>(list: readonly T[], item: T, max: number): T[] {
  const index = list.findIndex(entry => entry.id === item.id)
  if (index >= 0) return list.map(entry => entry.id === item.id ? item : entry)
  if (list.length >= max) throw new Error(`You can keep up to ${max}. Delete an old one first.`)
  return [item, ...list]
}
export const removeEntry = <T extends { id: string }>(list: readonly T[], id: string) => list.filter(entry => entry.id !== id)
