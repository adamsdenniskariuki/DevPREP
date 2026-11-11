import reactIds from './generated/react-ids.json' with { type: 'json' }

/* ---------- Content ---------- */

export interface ReactSection { title: string; body: string; code?: string }
export interface ReactGotcha { question: string; code?: string; answer: string }
export interface ReactLesson { id: string; title: string; minutes: number; summary: string; sections: ReactSection[]; pitfalls: string[]; gotchas: ReactGotcha[] }
export interface ReactExercise {
  id: string
  title: string
  /** The lesson this exercise practises. */
  lesson: string
  minutes: number
  summary: string
  prompt: string
  hints: string[]
  starter: string
  solution: string
  /** The checking tests (App.test.tsx), shown read-only. */
  tests: string
}
export interface ReactContent { lessons: ReactLesson[]; exercises: ReactExercise[] }

/** Lesson and exercise ids, in course order. Append-only: progress and plans refer to them. */
export const REACT_LESSON_IDS: readonly string[] = reactIds.lessons
export const REACT_EXERCISE_IDS: readonly string[] = reactIds.exercises
export const reactExerciseIds: ReadonlySet<string> = new Set(reactIds.exercises)
/** Every id that #react/<id> can open. */
export const reactItemIds: ReadonlySet<string> = new Set([...reactIds.lessons, ...reactIds.exercises])

let cache: Promise<ReactContent> | undefined
/** Lessons and exercises, built from content/react by scripts/build-content.mjs. */
export function loadReact(): Promise<ReactContent> {
  cache ??= import('./generated/react.json').then(module => module.default as unknown as ReactContent)
  return cache
}

/* ---------- Progress (backed up) ---------- */

export const REACT_KEY = 'devprep.react.v1'
export const MAX_REACT_BYTES = 20_000
const MAX_ATTEMPTS = 10_000
const DAY = /^\d{4}-\d{2}-\d{2}$/

export interface ExerciseProgress {
  /** Runs so far. */
  attempts: number
  /** The local day every test first passed. */
  completed?: string
}
export type ReactProgress = Record<string, ExerciseProgress>

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks React exercise progress from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parseReactProgress(value: unknown): ReactProgress {
  if (!isRec(value)) invalid('React progress must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_REACT_BYTES) invalid('React progress is larger than 20 KB.')
  const state: ReactProgress = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!reactExerciseIds.has(id)) invalid(`unknown React exercise ${id}.`)
    if (!isRec(entry) || Object.keys(entry).some(key => !['attempts', 'completed'].includes(key))) invalid(`React exercise ${id} has unexpected fields.`)
    if (!Number.isInteger(entry.attempts) || (entry.attempts as number) < 0 || (entry.attempts as number) > MAX_ATTEMPTS) invalid(`React exercise ${id} has an invalid attempt count.`)
    if (entry.completed !== undefined && (typeof entry.completed !== 'string' || !DAY.test(entry.completed))) invalid(`React exercise ${id} has an invalid completion date.`)
    state[id] = { attempts: entry.attempts as number, ...entry.completed ? { completed: entry.completed as string } : {} }
  }
  return state
}

export function readReactProgress(): ReactProgress {
  try {
    return parseReactProgress(JSON.parse(window.localStorage.getItem(REACT_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves synchronously. False when the browser refuses (private mode or storage full). */
export function writeReactProgress(state: ReactProgress): boolean {
  try {
    window.localStorage.setItem(REACT_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const recordReactRun = (entry: ExerciseProgress | undefined, passed: boolean, today: string): ExerciseProgress => ({
  ...entry, attempts: Math.min((entry?.attempts ?? 0) + 1, MAX_ATTEMPTS), ...passed && !entry?.completed ? { completed: today } : {},
})

export const reactCompletedCount = (state: ReactProgress) => REACT_EXERCISE_IDS.filter(id => state[id]?.completed).length

/* ---------- Drafts (on device only, not backed up) ---------- */

export const REACT_DRAFTS_KEY = 'devprep.react.drafts.v1'
export const MAX_REACT_DRAFT = 20_000
const MAX_DRAFTS = 24

function readDrafts(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REACT_DRAFTS_KEY) ?? '{}')
    return isRec(parsed) ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  } catch {
    return {}
  }
}

export const readReactDraft = (id: string): string | undefined => readDrafts()[id]

/** Saves one exercise's code, or clears it when undefined, keeping the most recent drafts only. False when the browser refused. */
export function writeReactDraft(id: string, code: string | undefined): boolean {
  try {
    const all = readDrafts()
    delete all[id]
    if (code !== undefined) {
      const keys = Object.keys(all)
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS + 1))) delete all[old]
      all[id] = code.slice(0, MAX_REACT_DRAFT)
    }
    window.localStorage.setItem(REACT_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
