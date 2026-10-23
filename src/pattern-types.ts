import type { Diagram, QuizItem } from './guide-types'
import type { ProblemDifficulty, ProblemLevel, ProblemTest } from './problem-types'

/** Languages a pattern exercise runs in. TypeScript is type-checked, then run as JavaScript. */
export type PatternLang = 'js' | 'py' | 'ts'
export const PATTERN_LANGS: readonly PatternLang[] = ['py', 'js', 'ts']
export const PATTERN_LANG_LABEL: Record<PatternLang, string> = { py: 'Python', js: 'JavaScript', ts: 'TypeScript' }

export interface PatternSignal {
  /** What you notice in the problem statement. */
  see: string
  /** The pattern move it suggests. */
  think: string
}

export interface PatternExample {
  label: string
  /** One text value per tracer parameter, as a learner would type it. */
  input: Record<string, string>
}

export interface PatternVisualiserSpec {
  /** Tracer id in src/patterns/tracers. */
  tracer: string
  function: { js: string; py: string }
  /**
   * Code shown beside the visualiser. A line the trace points at ends with a marker:
   * `//@key` in JavaScript, `#@key` in Python. Markers are stripped for display.
   */
  code: { js: string; py: string }
  examples: PatternExample[]
  inputHelp: string
}

export interface PatternExercise {
  prompt: string
  function: { js: string; py: string }
  starter: Record<PatternLang, string>
  solution: Record<PatternLang, string>
  tests: ProblemTest[]
  hiddenTests: ProblemTest[]
  hints: string[]
}

export interface PatternProblemLink {
  id: string
  role: ProblemDifficulty
}

/** One pattern page: content/patterns/<id>.json. */
export interface PatternPage {
  id: string
  title: string
  /** Parent page id when this page teaches a sub-pattern. */
  parent?: string
  /** The PROBLEM_PATTERNS category this page teaches. */
  category: string
  level: ProblemLevel
  summary: string
  minutes: number
  /** Core idea in one sentence, for the cheat sheet. */
  idea: string
  recognise: { signals: PatternSignal[]; phrasings: string[] }
  picture: Diagram
  visualiser: PatternVisualiserSpec
  template: Record<PatternLang, string>
  /** One-line template for the cheat sheet. */
  oneLiner: string
  exercise: PatternExercise
  problems: PatternProblemLink[]
  complexity: { time: string; space: string; why: string }
  mistakes: string[]
  quiz: QuizItem[]
  interviewTip: string
}

/** Small eager entry for the course home, cheat sheet, picker, planner and mocks. */
export interface PatternSummary {
  id: string
  title: string
  parent?: string
  category: string
  level: ProblemLevel
  summary: string
  minutes: number
  idea: string
  oneLiner: string
  time: string
  space: string
  signals: PatternSignal[]
  /** Short problem statements that hint at this pattern: the phrasings plus linked problems' first sentences. */
  drills: string[]
  problems: PatternProblemLink[]
}
