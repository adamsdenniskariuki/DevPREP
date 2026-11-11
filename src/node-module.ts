import nodeIds from './generated/node-ids.json' with { type: 'json' }
import type { ProjectLanguage, ProjectReport, RunPhase, RunProgress } from './runner/runner'
import type { ProjectRunRequest } from './runner/project'

/* ---------- Content ---------- */

export interface NodeSection { title: string; body: string; code?: string }
export interface NodeGotcha { question: string; code?: string; answer: string }
export interface NodeLesson { id: string; title: string; minutes: number; summary: string; sections: NodeSection[]; pitfalls: string[]; gotchas: NodeGotcha[] }
export interface NodeExercise {
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
export interface NodeContent { lessons: NodeLesson[]; exercises: NodeExercise[] }

/** Lesson and exercise ids, in course order. Append-only: progress and plans refer to them. */
export const NODE_LESSON_IDS: readonly string[] = nodeIds.lessons
export const NODE_EXERCISE_IDS: readonly string[] = nodeIds.exercises
export const nodeExerciseIds: ReadonlySet<string> = new Set(nodeIds.exercises)
/** Every id that #node/<id> can open. */
export const nodeItemIds: ReadonlySet<string> = new Set([...nodeIds.lessons, ...nodeIds.exercises])

let cache: Promise<NodeContent> | undefined
/** Lessons and exercises, built from content/node by scripts/build-content.mjs. */
export function loadNode(): Promise<NodeContent> {
  cache ??= import('./generated/node.json').then(module => module.default as unknown as NodeContent)
  return cache
}

/* ---------- Running ---------- */

/** The file the learner edits and the read-only test file; tests import from "./index". */
export const NODE_FILE = 'index.ts'
export const NODE_TEST_FILE = 'index.test.ts'

/** How many tests a run will report: every exported test* function. */
export const nodeTestCount = (tests: string) => tests.match(/^export\s+(?:async\s+)?function\s+test\w*/gm)?.length ?? 0

type ProjectRunner = (lang: ProjectLanguage, request: ProjectRunRequest, onPhase?: (phase: RunPhase) => void, onProgress?: RunProgress) => Promise<ProjectReport>

/** Runs an exercise as a two-file TypeScript project in the browser sandbox (not real Node.js). The runner is passed in so this module stays light. */
export function runNodeExercise(runProject: ProjectRunner, code: string, tests: string, options: { onPhase: (phase: RunPhase) => void; onTotal: (total: number) => void; onProgress: RunProgress }): Promise<ProjectReport> {
  options.onTotal(nodeTestCount(tests))
  return runProject('ts', { files: { [NODE_FILE]: code, [NODE_TEST_FILE]: tests }, tests: [NODE_TEST_FILE] }, options.onPhase, options.onProgress)
}

/* ---------- Progress (backed up) ---------- */

export const NODE_KEY = 'devprep.node.v1'
export const MAX_NODE_BYTES = 20_000
const MAX_ATTEMPTS = 10_000
const DAY = /^\d{4}-\d{2}-\d{2}$/

export interface ExerciseProgress {
  /** Runs so far. */
  attempts: number
  /** The local day every test first passed. */
  completed?: string
}
export type NodeProgress = Record<string, ExerciseProgress>

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks Node.js exercise progress from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parseNodeProgress(value: unknown): NodeProgress {
  if (!isRec(value)) invalid('Node.js progress must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_NODE_BYTES) invalid('Node.js progress is larger than 20 KB.')
  const state: NodeProgress = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!nodeExerciseIds.has(id)) invalid(`unknown Node.js exercise ${id}.`)
    if (!isRec(entry) || Object.keys(entry).some(key => !['attempts', 'completed'].includes(key))) invalid(`Node.js exercise ${id} has unexpected fields.`)
    if (!Number.isInteger(entry.attempts) || (entry.attempts as number) < 0 || (entry.attempts as number) > MAX_ATTEMPTS) invalid(`Node.js exercise ${id} has an invalid attempt count.`)
    if (entry.completed !== undefined && (typeof entry.completed !== 'string' || !DAY.test(entry.completed))) invalid(`Node.js exercise ${id} has an invalid completion date.`)
    state[id] = { attempts: entry.attempts as number, ...entry.completed ? { completed: entry.completed as string } : {} }
  }
  return state
}

export function readNodeProgress(): NodeProgress {
  try {
    return parseNodeProgress(JSON.parse(window.localStorage.getItem(NODE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves synchronously. False when the browser refuses (private mode or storage full). */
export function writeNodeProgress(state: NodeProgress): boolean {
  try {
    window.localStorage.setItem(NODE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const recordNodeRun = (entry: ExerciseProgress | undefined, passed: boolean, today: string): ExerciseProgress => ({
  ...entry, attempts: Math.min((entry?.attempts ?? 0) + 1, MAX_ATTEMPTS), ...passed && !entry?.completed ? { completed: today } : {},
})

export const nodeCompletedCount = (state: NodeProgress) => NODE_EXERCISE_IDS.filter(id => state[id]?.completed).length

/* ---------- Drafts (on device only, not backed up) ---------- */

export const NODE_DRAFTS_KEY = 'devprep.node.drafts.v1'
export const MAX_NODE_DRAFT = 20_000
const MAX_DRAFTS = 24

function readDrafts(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(NODE_DRAFTS_KEY) ?? '{}')
    return isRec(parsed) ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  } catch {
    return {}
  }
}

export const readNodeDraft = (id: string): string | undefined => readDrafts()[id]

/** Saves one exercise's code, or clears it when undefined, keeping the most recent drafts only. False when the browser refused. */
export function writeNodeDraft(id: string, code: string | undefined): boolean {
  try {
    const all = readDrafts()
    delete all[id]
    if (code !== undefined) {
      const keys = Object.keys(all)
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS + 1))) delete all[old]
      all[id] = code.slice(0, MAX_NODE_DRAFT)
    }
    window.localStorage.setItem(NODE_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
