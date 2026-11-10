import type { Diagram } from './guide-types'
import type { ProblemTest } from './problem-types'
import type { Tolerance } from './runner/core'

/** Runnable Python + NumPy labs for the math plan, built from content/math by scripts/build-content.mjs. */
export const MATH_PLAN_ID = 'math-for-ml-6wk'
export const MATH_TOPICS = ['linear-algebra', 'probability', 'statistics', 'calculus', 'optimisation'] as const
export type MathTopic = typeof MATH_TOPICS[number]
export const MATH_TOPIC_LABELS: Record<MathTopic, string> = {
  'linear-algebra': 'Linear algebra', probability: 'Probability', statistics: 'Statistics', calculus: 'Calculus', optimisation: 'Optimisation',
}
/** Floats are compared like math.isclose with these settings unless a lab sets its own. */
export const DEFAULT_TOLERANCE: Tolerance = { rel: 1e-6, abs: 1e-9 }
/** Every math lab imports NumPy, so the runner loads it before the learner's code. */
export const MATH_PACKAGES = ['numpy']

export interface MathLab {
  id: string
  title: string
  topic: MathTopic
  minutes: number
  summary: string
  /** Short reading, one paragraph per entry. Supports `code` and **bold**. */
  intro: string[]
  /** The key formula in plain Unicode, shown in a monospace block. */
  formula?: string
  prompt: string
  function: string
  starter: string
  solution: string
  tests: ProblemTest[]
  hiddenTests: ProblemTest[]
  tolerance?: Tolerance
  hints: string[]
  explanation: string
  /** Lesson ids to read alongside the lab. */
  lessons?: string[]
  diagram?: Diagram
}

export const labTolerance = (lab: MathLab): Tolerance => ({ ...DEFAULT_TOLERANCE, ...lab.tolerance })
export const mathLabHref = (id: string) => `#plans/${MATH_PLAN_ID}/${id}`

let cache: Promise<MathLab[]> | undefined
/** Loads every lab once, in a lazy chunk. */
export function loadMathLabs(): Promise<MathLab[]> {
  cache ??= import('./generated/math-labs.json').then(json => json.default as unknown as MathLab[])
  cache.catch(() => { cache = undefined })
  return cache
}
