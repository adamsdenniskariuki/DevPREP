import codebaseIds from './generated/codebase-ids.json' with { type: 'json' }
import type { ProjectRunRequest } from './runner/project'

/* ---------- Content ---------- */

export type CodebaseLanguage = 'py' | 'ts'
export type CodebaseStepId = 'clarify' | 'orient' | 'reproduce' | 'trace' | 'change' | 'verify' | 'wrap-up'
export interface GuideStep { id: CodebaseStepId; title: string; minutes: string; body: string[]; checklist: string[] }
export interface RubricArea { id: string; title: string; steps: CodebaseStepId[]; levels: [string, string, string, string] }
export interface CodebaseGuide { title: string; summary: string; steps: GuideStep[]; throughout: string[]; rubric: RubricArea[] }
export interface Walkthrough { questions: string[]; orient: string[]; failingTest: string; trace: string[]; wrapUp: string[] }
export interface FileDiff { path: string; diff: string }
export interface CodebaseTask {
  id: string
  kind: 'bug' | 'feature'
  title: string
  minutes: number
  brief: string[]
  done: string[]
  walkthrough: Walkthrough
  /** Files the seeded bug changes; empty for a feature request. */
  starter: Record<string, string>
  /** Files the model answer changes, applied over the starter. */
  solution: Record<string, string>
  /** Tests run only on Submit. Never shown in the UI. */
  hidden: Record<string, string>
  diff: FileDiff[]
}
export interface CodebaseRepo { id: string; title: string; lang: CodebaseLanguage; summary: string; files: Record<string, string>; tasks: CodebaseTask[] }
export interface CodebaseContent { guide: CodebaseGuide; repos: CodebaseRepo[] }

/** "repo/task" for every practice task, in course order. Tiny, so routes and backups can check ids eagerly. */
export const CODEBASE_TASK_IDS: readonly string[] = codebaseIds
export const codebaseTaskIds: ReadonlySet<string> = new Set(codebaseIds)
export const CODEBASE_REPO_IDS: ReadonlySet<string> = new Set(codebaseIds.map(id => id.split('/')[0]))
export const taskKey = (repoId: string, taskId: string) => `${repoId}/${taskId}`

let cache: Promise<CodebaseContent> | undefined
/** The guide and every practice codebase, built from content/codebase by scripts/build-content.mjs. */
export function loadCodebase(): Promise<CodebaseContent> {
  cache ??= import('./generated/codebase.json').then(module => module.default as unknown as CodebaseContent)
  return cache
}

export const LANGUAGE_LABELS: Record<CodebaseLanguage, string> = { py: 'Python', ts: 'TypeScript' }

const VISIBLE_TEST: Record<CodebaseLanguage, RegExp> = { py: /^tests\/test_[a-z0-9_]+\.py$/, ts: /^tests\/[a-z0-9-]+\.test\.ts$/ }
export const isTestFile = (lang: CodebaseLanguage, path: string) => VISIBLE_TEST[lang].test(path)

/** The files the learner starts from: the repo plus the seeded bug, if any. */
export const starterFiles = (repo: CodebaseRepo, task: CodebaseTask): Record<string, string> => ({ ...repo.files, ...task.starter })
/** The model answer's files. */
export const solutionFiles = (repo: CodebaseRepo, task: CodebaseTask): Record<string, string> => ({ ...starterFiles(repo, task), ...task.solution })

/** Run tests: only the visible test files in the learner's current files. */
export function visibleRequest(lang: CodebaseLanguage, files: Record<string, string>): ProjectRunRequest {
  return { files, tests: Object.keys(files).filter(path => isTestFile(lang, path)).sort() }
}

/** Submit: the learner's visible tests plus the hidden review tests. Hidden files replace any learner file of the same name. */
export function submitRequest(lang: CodebaseLanguage, files: Record<string, string>, task: CodebaseTask): ProjectRunRequest {
  const visible = visibleRequest(lang, files)
  const hidden = Object.keys(task.hidden).sort()
  return { files: { ...files, ...task.hidden }, tests: [...visible.tests.filter(path => !hidden.includes(path)), ...hidden] }
}

/** True when a test name ("file::test") comes from a hidden file, so the UI can hide its source. */
export const isHiddenOutcome = (task: CodebaseTask, name: string) => Object.keys(task.hidden).some(path => name.startsWith(`${path}::`))

/** Files the UI shows: everything but README first-class, sorted with folders before root files. */
export function sortPaths(paths: readonly string[]): string[] {
  return [...paths].sort((a, b) => {
    const da = a.includes('/'), db = b.includes('/')
    if (da !== db) return da ? -1 : 1
    return a.localeCompare(b)
  })
}

/* ---------- Progress (backed up under "codebase") ---------- */

export const CODEBASE_KEY = 'devprep.codebase.v1'
export const MAX_CODEBASE_BYTES = 50_000
const MAX_ATTEMPTS = 10_000
const DAY = /^\d{4}-\d{2}-\d{2}$/
export type Scores = [number, number, number, number]
export interface TaskProgress {
  /** Submits so far. */
  attempts: number
  /** Highest-average self-review scorecard, areas in rubric order. */
  best?: Scores
  /** The local day every visible and hidden test first passed on Submit. */
  completed?: string
  /** The model walkthrough has been opened. */
  revealed?: boolean
}
export type CodebaseProgress = Record<string, TaskProgress>

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isScores = (value: unknown): value is Scores => Array.isArray(value) && value.length === 4 && value.every(score => Number.isInteger(score) && score >= 1 && score <= 4)

/** Checks codebase practice progress from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parseCodebaseProgress(value: unknown): CodebaseProgress {
  if (!isRec(value)) invalid('codebase practice must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_CODEBASE_BYTES) invalid('codebase practice is larger than 50 KB.')
  const state: CodebaseProgress = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!codebaseTaskIds.has(id)) invalid(`unknown codebase task ${id}.`)
    if (!isRec(entry) || Object.keys(entry).some(key => !['attempts', 'best', 'completed', 'revealed'].includes(key))) invalid(`codebase task ${id} has unexpected fields.`)
    if (!Number.isInteger(entry.attempts) || (entry.attempts as number) < 0 || (entry.attempts as number) > MAX_ATTEMPTS) invalid(`codebase task ${id} has an invalid attempt count.`)
    if (entry.best !== undefined && !isScores(entry.best)) invalid(`codebase task ${id} scores must be four whole numbers from 1 to 4.`)
    if (entry.completed !== undefined && (typeof entry.completed !== 'string' || !DAY.test(entry.completed))) invalid(`codebase task ${id} has an invalid completion date.`)
    if (entry.revealed !== undefined && typeof entry.revealed !== 'boolean') invalid(`codebase task ${id} has an invalid reveal flag.`)
    state[id] = {
      attempts: entry.attempts as number,
      ...entry.best ? { best: [...entry.best as Scores] as Scores } : {},
      ...entry.completed ? { completed: entry.completed as string } : {},
      ...entry.revealed ? { revealed: true } : {},
    }
  }
  return state
}

export function readCodebaseProgress(): CodebaseProgress {
  try {
    return parseCodebaseProgress(JSON.parse(window.localStorage.getItem(CODEBASE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves synchronously. False when the browser refuses (private mode or storage full). */
export function writeCodebaseProgress(state: CodebaseProgress): boolean {
  try {
    window.localStorage.setItem(CODEBASE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

const average = (scores: Scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length

/** Pure updates. */
export const recordAttempt = (entry: TaskProgress | undefined, passed: boolean, today: string): TaskProgress => ({
  ...entry, attempts: (entry?.attempts ?? 0) + 1, ...passed && !entry?.completed ? { completed: today } : {},
})
export const recordScores = (entry: TaskProgress | undefined, scores: Scores): TaskProgress => ({
  attempts: 0, ...entry, ...!entry?.best || average(scores) >= average(entry.best) ? { best: [...scores] as Scores } : {},
})
export const recordReveal = (entry: TaskProgress | undefined): TaskProgress => ({ attempts: 0, ...entry, revealed: true })

export const completedCount = (state: CodebaseProgress) => CODEBASE_TASK_IDS.filter(id => state[id]?.completed).length

/* ---------- Drafts (on device only, not backed up) ---------- */

export const CODEBASE_DRAFTS_KEY = 'devprep.codebase.drafts.v1'
export const MAX_FILE_LENGTH = 20_000
const MAX_TASK_DRAFTS = 24

export interface TimerState {
  /** Milliseconds counted before the current run. */
  elapsed: number
  /** Epoch ms when the timer was last started; absent while paused. */
  since?: number
}
export interface TaskDraft {
  /** Only files that differ from the starter. */
  files: Record<string, string>
  timer?: TimerState
  /** Set once the task has been submitted, so the walkthrough stays available after a reload. */
  submitted?: boolean
}
type DraftStore = Record<string, TaskDraft>

function readDrafts(): DraftStore {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CODEBASE_DRAFTS_KEY) ?? '{}')
    return isRec(parsed) ? parsed as DraftStore : {}
  } catch {
    return {}
  }
}

export function readTaskDraft(key: string): TaskDraft {
  const draft = readDrafts()[key]
  if (!isRec(draft)) return { files: {} }
  const files: Record<string, string> = {}
  if (isRec(draft.files)) for (const [path, text] of Object.entries(draft.files)) if (typeof text === 'string') files[path] = text.slice(0, MAX_FILE_LENGTH)
  const timer = isRec(draft.timer) && typeof draft.timer.elapsed === 'number' && draft.timer.elapsed >= 0
    ? { elapsed: draft.timer.elapsed, ...typeof draft.timer.since === 'number' ? { since: draft.timer.since } : {} } : undefined
  return { files, ...timer ? { timer } : {}, ...draft.submitted === true ? { submitted: true } : {} }
}

/** Saves one task's draft, keeping the most recent tasks only. False when the browser refused. */
export function writeTaskDraft(key: string, draft: TaskDraft): boolean {
  try {
    const all = readDrafts()
    delete all[key]
    const keys = Object.keys(all)
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TASK_DRAFTS + 1))) delete all[old]
    all[key] = draft
    window.localStorage.setItem(CODEBASE_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

/** Only the files that differ from the starter, so drafts stay small. */
export function changedFiles(starter: Record<string, string>, files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([path, text]) => starter[path] !== text))
}

export const timerElapsed = (timer: TimerState | undefined, now: number) => !timer ? 0 : timer.elapsed + (timer.since ? Math.max(0, now - timer.since) : 0)
