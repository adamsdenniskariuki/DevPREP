/** Timed system design practice on a whiteboard. Kept out of the main bundle: only board screens use it. */

export const PRACTICE_PRESETS = [35, 45] as const
export type PracticeMinutes = typeof PRACTICE_PRESETS[number]
export const CHECKLIST = ['Requirements', 'Estimates', 'API', 'Data model', 'High-level design', 'Deep dive and bottlenecks', 'Trade-offs'] as const
export const WARN_MS = 5 * 60_000
/** Long enough for any real attempt; guards against bad clocks and hand-edited backups. */
export const MAX_SPENT_MS = 24 * 60 * 60_000

export interface PracticeState {
  minutes: PracticeMinutes
  /** Time on the clock before the current run. */
  spentMs: number
  /** Epoch ms when the clock last started. Absent while paused or finished. */
  runningSince?: number
  /** Set once the attempt is finished and reviewed. */
  finishedAt?: string
  /** Self-review ticks, one per CHECKLIST item. */
  checks: boolean[]
}

export function newPractice(minutes: PracticeMinutes, now = Date.now()): PracticeState {
  return { minutes, spentMs: 0, runningSince: now, checks: CHECKLIST.map(() => false) }
}

/** Time used so far. The clock keeps counting after the preset runs out, so overtime shows. */
export function spent(state: PracticeState, now = Date.now()): number {
  const run = state.runningSince === undefined ? 0 : Math.max(0, now - state.runningSince)
  return Math.min(MAX_SPENT_MS, state.spentMs + run)
}

/** Negative once the preset time is used up. */
export const remaining = (state: PracticeState, now = Date.now()) => state.minutes * 60_000 - spent(state, now)

export function pause(state: PracticeState, now = Date.now()): PracticeState {
  if (state.runningSince === undefined) return state
  const { runningSince: _, ...rest } = state
  return { ...rest, spentMs: spent(state, now) }
}

export function resume(state: PracticeState, now = Date.now()): PracticeState {
  if (state.runningSince !== undefined || state.finishedAt) return state
  return { ...state, runningSince: now }
}

export function finish(state: PracticeState, now = Date.now()): PracticeState {
  if (state.finishedAt) return state
  return { ...pause(state, now), finishedAt: new Date(now).toISOString() }
}

export function tick(state: PracticeState, index: number, checked: boolean): PracticeState {
  if (index < 0 || index >= CHECKLIST.length) return state
  return { ...state, checks: state.checks.map((value, i) => i === index ? checked : value) }
}

export const ticked = (state: PracticeState) => state.checks.filter(Boolean).length

/** m:ss, or +m:ss once over time. */
export function clock(ms: number): string {
  const over = ms < 0
  const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000)
  return `${over ? '+' : ''}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Plain words for screen readers and attempt lists, e.g. "31 min 20 s". */
export function duration(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000)
  const minutes = Math.floor(total / 60), seconds = total % 60
  return minutes ? `${minutes} min${seconds ? ` ${seconds} s` : ''}` : `${seconds} s`
}

/** One line about an attempt, e.g. "31 min 20 s of 35 min · 5 of 7 ticked". */
export function attemptText(state: PracticeState): string {
  if (!state.finishedAt) return `In progress · ${state.minutes} min`
  return `${duration(spent(state))} of ${state.minutes} min · ${ticked(state)} of ${CHECKLIST.length} ticked`
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const KEYS = ['minutes', 'spentMs', 'checks']
const OPTIONAL = ['runningSince', 'finishedAt']

/** Strictly checks practice state from a backup. Throws a short reason. */
export function parsePractice(value: unknown): PracticeState {
  if (!isRec(value) || Object.keys(value).some(key => !KEYS.includes(key) && !OPTIONAL.includes(key)) || KEYS.some(key => !Object.hasOwn(value, key))) {
    throw new Error('practice details have unexpected or missing fields.')
  }
  if (!PRACTICE_PRESETS.includes(value.minutes as PracticeMinutes)) throw new Error('practice has an unknown time limit.')
  if (!Number.isInteger(value.spentMs) || (value.spentMs as number) < 0 || (value.spentMs as number) > MAX_SPENT_MS) throw new Error('practice has an invalid time taken.')
  if (!Array.isArray(value.checks) || value.checks.length !== CHECKLIST.length || value.checks.some(item => typeof item !== 'boolean')) throw new Error('practice has an invalid checklist.')
  const state: PracticeState = { minutes: value.minutes as PracticeMinutes, spentMs: value.spentMs as number, checks: [...value.checks as boolean[]] }
  if (Object.hasOwn(value, 'finishedAt')) {
    if (typeof value.finishedAt !== 'string' || !ISO.test(value.finishedAt) || new Date(value.finishedAt).toISOString() !== value.finishedAt) throw new Error('practice has an invalid finish time.')
    state.finishedAt = value.finishedAt
  }
  if (Object.hasOwn(value, 'runningSince')) {
    if (state.finishedAt) throw new Error('a finished practice cannot still be running.')
    if (!Number.isInteger(value.runningSince) || (value.runningSince as number) <= 0) throw new Error('practice has an invalid start time.')
    state.runningSince = value.runningSince as number
  }
  return state
}
