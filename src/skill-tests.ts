import skillTestIds from './generated/skill-test-ids.json' with { type: 'json' }

/* ---------- Content ---------- */

export interface SkillTopic { id: string; title: string; /** Where to study a weak topic, e.g. "#react/react-effects". */ review: string }
export interface SkillQuestion {
  id: string
  topic: string
  prompt: string
  /** A snippet the question asks about ("what does this render?"). */
  code?: string
  choices: [string, string, string, string]
  /** Index of the correct choice. */
  answer: number
  explain: string
}
/** A coding task reuses a runnable exercise from a module (see skill-test-tasks.ts). */
export interface SkillTask { id: string; title: string; module: string; exercise: string }
export interface SkillTest {
  id: string
  title: string
  summary: string
  minutes: number
  /** How many questions one attempt draws, spread across the topics. */
  pick: number
  topics: SkillTopic[]
  questions: SkillQuestion[]
  tasks: SkillTask[]
}

/** Test, question and task ids. Append-only: attempts and backups refer to them. */
export const SKILL_TESTS: readonly { id: string; title: string; questions: string[]; tasks: string[] }[] = skillTestIds
export const skillTestIdSet: ReadonlySet<string> = new Set(skillTestIds.map(test => test.id))

let cache: Promise<SkillTest[]> | undefined
/** Every skill test, built from content/skill-tests by scripts/build-content.mjs. */
export function loadSkillTests(): Promise<SkillTest[]> {
  cache ??= import('./generated/skill-tests.json').then(module => module.default as unknown as SkillTest[])
  return cache
}

/* ---------- Picking and scoring (pure) ---------- */

/** A small seeded generator, so a resumed attempt draws the same questions. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Draws `pick` question ids spread evenly across topics: topics take turns giving one question each until enough
 * are drawn, so every topic appears and none dominates. The order is then shuffled.
 */
export function pickQuestions(test: Pick<SkillTest, 'pick' | 'topics' | 'questions'>, seed: number): string[] {
  const random = seededRandom(seed)
  const pools = shuffle(test.topics, random).map(topic => shuffle(test.questions.filter(question => question.topic === topic.id), random))
  const picked: string[] = []
  const limit = Math.min(test.pick, test.questions.length)
  for (let round = 0; picked.length < limit; round++) {
    for (const pool of pools) {
      if (picked.length >= limit) break
      if (round < pool.length) picked.push(pool[round].id)
    }
  }
  return shuffle(picked, random)
}

/** Below this share of correct answers a topic is weak and sent to review. */
export const WEAK_BELOW = 0.7

export interface TopicScore { topic: SkillTopic; correct: number; total: number; weak: boolean }
export interface SkillScore {
  correct: number
  total: number
  /** Whole percent of questions answered correctly. */
  percent: number
  topics: TopicScore[]
  tasksPassed: number
  taskTotal: number
}

export function scoreAttempt(test: SkillTest, questionIds: readonly string[], answers: Readonly<Record<string, number>>, tasks: Readonly<Record<string, TaskStatus>> = {}): SkillScore {
  const byId = new Map(test.questions.map(question => [question.id, question]))
  const asked = questionIds.map(id => byId.get(id)).filter((question): question is SkillQuestion => !!question)
  const correct = asked.filter(question => answers[question.id] === question.answer).length
  const topics = test.topics.flatMap(topic => {
    const inTopic = asked.filter(question => question.topic === topic.id)
    if (!inTopic.length) return []
    const right = inTopic.filter(question => answers[question.id] === question.answer).length
    return [{ topic, correct: right, total: inTopic.length, weak: right / inTopic.length < WEAK_BELOW }]
  })
  return {
    correct, total: asked.length, percent: asked.length ? Math.round((correct / asked.length) * 100) : 0, topics,
    tasksPassed: test.tasks.filter(task => tasks[task.id] === 'passed').length, taskTotal: test.tasks.length,
  }
}

/* ---------- The attempt in progress (on device only, not backed up) ---------- */

export const SKILL_ATTEMPT_KEY = 'devprep.skilltests.attempt.v1'
export const MAX_TASK_CODE = 20_000
export type TaskStatus = 'passed' | 'failed'

export interface SkillAttempt {
  seed: number
  /** Epoch ms when the attempt started. The deadline is this plus the test's minutes. */
  started: number
  questions: string[]
  /** Question id → chosen choice index. */
  answers: Record<string, number>
  /** Task id → edited code. */
  code: Record<string, string>
  /** Task id → result of the latest run. */
  tasks: Record<string, TaskStatus>
}

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Starts a new attempt with its questions drawn. */
export function newAttempt(test: SkillTest, now: number, seed = Math.floor(Math.random() * 2 ** 32)): SkillAttempt {
  return { seed, started: now, questions: pickQuestions(test, seed), answers: {}, code: {}, tasks: {} }
}

export const attemptDeadline = (test: Pick<SkillTest, 'minutes'>, attempt: Pick<SkillAttempt, 'started'>) => attempt.started + test.minutes * 60_000

function readAttempts(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SKILL_ATTEMPT_KEY) ?? '{}')
    return isRec(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** The saved in-progress attempt for a test, dropping anything that no longer matches the test's content. */
export function readAttempt(test: SkillTest): SkillAttempt | undefined {
  const value = readAttempts()[test.id]
  if (!isRec(value) || !Number.isFinite(value.seed) || !Number.isFinite(value.started) || !Array.isArray(value.questions)) return undefined
  const known = new Set(test.questions.map(question => question.id))
  const questions = value.questions.filter((id): id is string => typeof id === 'string' && known.has(id))
  if (!questions.length) return undefined
  const answers: Record<string, number> = {}
  if (isRec(value.answers)) for (const [id, choice] of Object.entries(value.answers)) if (questions.includes(id) && Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < 4) answers[id] = choice as number
  const taskIds = new Set(test.tasks.map(task => task.id))
  const code: Record<string, string> = {}
  if (isRec(value.code)) for (const [id, text] of Object.entries(value.code)) if (taskIds.has(id) && typeof text === 'string') code[id] = text.slice(0, MAX_TASK_CODE)
  const tasks: Record<string, TaskStatus> = {}
  if (isRec(value.tasks)) for (const [id, status] of Object.entries(value.tasks)) if (taskIds.has(id) && (status === 'passed' || status === 'failed')) tasks[id] = status
  return { seed: value.seed as number, started: value.started as number, questions, answers, code, tasks }
}

/** Saves or (with undefined) clears a test's attempt. False when the browser refused. */
export function writeAttempt(testId: string, attempt: SkillAttempt | undefined): boolean {
  try {
    const all = readAttempts()
    if (attempt) all[testId] = attempt
    else delete all[testId]
    window.localStorage.setItem(SKILL_ATTEMPT_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

/* ---------- Finished attempts (backed up) ---------- */

export const SKILL_TESTS_KEY = 'devprep.skilltests.v1'
export const MAX_SKILL_TESTS_BYTES = 50_000
/** Most recent results kept per test. */
export const MAX_RESULTS = 20
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TOPIC = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface SkillResult {
  /** Local day the attempt was submitted. */
  date: string
  correct: number
  total: number
  tasksPassed: number
  taskTotal: number
  /** Topic ids under the weak threshold. */
  weak: string[]
}
export type SkillTestsState = Record<string, SkillResult[]>

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}
const count = (value: unknown, max: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max

/** Checks skill-test results from a backup or storage, throwing "Invalid backup: …" on any problem. */
export function parseSkillTests(value: unknown): SkillTestsState {
  if (!isRec(value)) invalid('skill test results must be an object.')
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_SKILL_TESTS_BYTES) invalid('skill test results are larger than 50 KB.')
  const state: SkillTestsState = {}
  for (const [id, results] of Object.entries(value)) {
    if (!skillTestIdSet.has(id)) invalid(`unknown skill test ${id}.`)
    if (!Array.isArray(results) || results.length > MAX_RESULTS) invalid(`skill test ${id} must have at most ${MAX_RESULTS} results.`)
    state[id] = results.map(result => {
      if (!isRec(result) || Object.keys(result).sort().join() !== 'correct,date,taskTotal,tasksPassed,total,weak') invalid(`a skill test ${id} result has unexpected or missing fields.`)
      if (typeof result.date !== 'string' || !DAY.test(result.date)) invalid(`a skill test ${id} result has an invalid date.`)
      if (!count(result.total, 1000) || !count(result.correct, result.total as number)) invalid(`a skill test ${id} result has an invalid score.`)
      if (!count(result.taskTotal, 100) || !count(result.tasksPassed, result.taskTotal as number)) invalid(`a skill test ${id} result has an invalid task count.`)
      if (!Array.isArray(result.weak) || result.weak.length > 100 || result.weak.some(topic => typeof topic !== 'string' || !TOPIC.test(topic))) invalid(`a skill test ${id} result has invalid weak topics.`)
      return { date: result.date, correct: result.correct as number, total: result.total as number, tasksPassed: result.tasksPassed as number, taskTotal: result.taskTotal as number, weak: [...result.weak as string[]] }
    })
  }
  return state
}

export function readSkillTests(): SkillTestsState {
  try {
    return parseSkillTests(JSON.parse(window.localStorage.getItem(SKILL_TESTS_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/** Saves synchronously. False when the browser refuses (private mode or storage full). */
export function writeSkillTests(state: SkillTestsState): boolean {
  try {
    window.localStorage.setItem(SKILL_TESTS_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/** Adds a result, newest last, keeping the most recent MAX_RESULTS. */
export function recordResult(state: SkillTestsState, testId: string, score: SkillScore, today: string): SkillTestsState {
  const result: SkillResult = {
    date: today, correct: score.correct, total: score.total, tasksPassed: score.tasksPassed, taskTotal: score.taskTotal,
    weak: score.topics.filter(topic => topic.weak).map(topic => topic.topic.id),
  }
  return { ...state, [testId]: [...state[testId] ?? [], result].slice(-MAX_RESULTS) }
}
