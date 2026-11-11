import reactNativeIds from './generated/react-native-ids.json' with { type: 'json' }
import type { ProjectLanguage, ProjectReport, RunPhase, RunProgress } from './runner/runner'
import type { ProjectRunRequest } from './runner/project'

/* ---------- Content ---------- */

export interface ReactNativeSection { title: string; body: string; code?: string }
export interface ReactNativeGotcha { question: string; code?: string; answer: string }
export interface ReactNativeLesson { id: string; title: string; minutes: number; summary: string; sections: ReactNativeSection[]; pitfalls: string[]; gotchas: ReactNativeGotcha[] }
export interface ReactNativeExercise {
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
  /** The checking tests (index.test.ts), shown read-only. */
  tests: string
}
export interface ReactNativeContent { lessons: ReactNativeLesson[]; exercises: ReactNativeExercise[] }

/** Lesson and exercise ids, in course order. Append-only: progress and plans refer to them. */
export const REACT_NATIVE_LESSON_IDS: readonly string[] = reactNativeIds.lessons
export const REACT_NATIVE_EXERCISE_IDS: readonly string[] = reactNativeIds.exercises
export const reactNativeExerciseIds: ReadonlySet<string> = new Set(reactNativeIds.exercises)
/** Every id that #react-native/<id> can open. */
export const reactNativeItemIds: ReadonlySet<string> = new Set([...reactNativeIds.lessons, ...reactNativeIds.exercises])

let cache: Promise<ReactNativeContent> | undefined
/** Lessons and exercises, built from content/react-native by scripts/build-content.mjs. */
export function loadReactNative(): Promise<ReactNativeContent> {
  cache ??= import('./generated/react-native.json').then(module => module.default as unknown as ReactNativeContent)
  return cache
}

/* ---------- Running ---------- */

/** The file the learner edits and the read-only test file; tests import from "./index". */
export const REACT_NATIVE_FILE = 'index.ts'
export const REACT_NATIVE_TEST_FILE = 'index.test.ts'

/** How many tests a run will report: every exported test* function. */
export const reactNativeTestCount = (tests: string) => tests.match(/^export\s+(?:async\s+)?function\s+test\w*/gm)?.length ?? 0

type ProjectRunner = (lang: ProjectLanguage, request: ProjectRunRequest, onPhase?: (phase: RunPhase) => void, onProgress?: RunProgress) => Promise<ProjectReport>

/** Runs an exercise as a two-file TypeScript project in the browser sandbox (no React Native runtime). The runner is passed in so this module stays light. */
export function runReactNativeExercise(runProject: ProjectRunner, code: string, tests: string, options: { onPhase: (phase: RunPhase) => void; onTotal: (total: number) => void; onProgress: RunProgress }): Promise<ProjectReport> {
  options.onTotal(reactNativeTestCount(tests))
  return runProject('ts', { files: { [REACT_NATIVE_FILE]: code, [REACT_NATIVE_TEST_FILE]: tests }, tests: [REACT_NATIVE_TEST_FILE] }, options.onPhase, options.onProgress)
}

/* ---------- Progress (backed up) ---------- */

export const REACT_NATIVE_KEY = 'devprep.react-native.v1'
export const MAX_REACT_NATIVE_BYTES = 20_000
const MAX_ATTEMPTS = 10_000
const DAY = /^\d{4}-\d{2}-\d{2}$/

export interface ExerciseProgress {
  /** Runs so far. */
  attempts: number
  /** The local day every test first passed. */
  completed?: string
}
export type ReactNativeProgress = Record<string, ExerciseProgress>

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks React Native exercise progress from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parseReactNativeProgress(value: unknown): ReactNativeProgress {
  if (!isRec(value)) invalid('React Native progress must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_REACT_NATIVE_BYTES) invalid('React Native progress is larger than 20 KB.')
  const state: ReactNativeProgress = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!reactNativeExerciseIds.has(id)) invalid(`unknown React Native exercise ${id}.`)
    if (!isRec(entry) || Object.keys(entry).some(key => !['attempts', 'completed'].includes(key))) invalid(`React Native exercise ${id} has unexpected fields.`)
    if (!Number.isInteger(entry.attempts) || (entry.attempts as number) < 0 || (entry.attempts as number) > MAX_ATTEMPTS) invalid(`React Native exercise ${id} has an invalid attempt count.`)
    if (entry.completed !== undefined && (typeof entry.completed !== 'string' || !DAY.test(entry.completed))) invalid(`React Native exercise ${id} has an invalid completion date.`)
    state[id] = { attempts: entry.attempts as number, ...entry.completed ? { completed: entry.completed as string } : {} }
  }
  return state
}

export function readReactNativeProgress(): ReactNativeProgress {
  try {
    return parseReactNativeProgress(JSON.parse(window.localStorage.getItem(REACT_NATIVE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves synchronously. False when the browser refuses (private mode or storage full). */
export function writeReactNativeProgress(state: ReactNativeProgress): boolean {
  try {
    window.localStorage.setItem(REACT_NATIVE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const recordReactNativeRun = (entry: ExerciseProgress | undefined, passed: boolean, today: string): ExerciseProgress => ({
  ...entry, attempts: Math.min((entry?.attempts ?? 0) + 1, MAX_ATTEMPTS), ...passed && !entry?.completed ? { completed: today } : {},
})

export const reactNativeCompletedCount = (state: ReactNativeProgress) => REACT_NATIVE_EXERCISE_IDS.filter(id => state[id]?.completed).length

/* ---------- Drafts (on device only, not backed up) ---------- */

export const REACT_NATIVE_DRAFTS_KEY = 'devprep.react-native.drafts.v1'
export const MAX_REACT_NATIVE_DRAFT = 20_000
const MAX_DRAFTS = 24

function readDrafts(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REACT_NATIVE_DRAFTS_KEY) ?? '{}')
    return isRec(parsed) ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  } catch {
    return {}
  }
}

export const readReactNativeDraft = (id: string): string | undefined => readDrafts()[id]

/** Saves one exercise's code, or clears it when undefined, keeping the most recent drafts only. False when the browser refused. */
export function writeReactNativeDraft(id: string, code: string | undefined): boolean {
  try {
    const all = readDrafts()
    delete all[id]
    if (code !== undefined) {
      const keys = Object.keys(all)
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS + 1))) delete all[old]
      all[id] = code.slice(0, MAX_REACT_NATIVE_DRAFT)
    }
    window.localStorage.setItem(REACT_NATIVE_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
