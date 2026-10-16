import type { Diagram } from './guide-types'

export type Track = 'dsa' | 'system-design' | 'ml' | 'ai' | 'behavioral' | 'python' | 'typescript' | 'sql'
/** Language tracks teach one programming language; lessons there carry a runnable lab. */
export type LabLanguage = 'py' | 'ts' | 'sql'
export type PathTag = 'swe' | 'senior'

export interface TeachingSection {
  title: string
  body: string
  code?: string
  /** Id of a diagram in the lesson lab, drawn under this section. */
  diagram?: string
}

export interface LessonCore {
  id: string
  track: Track
  title: string
  minutes: number
  summary: string
  objectives: string[]
  concepts: TeachingSection[]
  example: string
  task: string
  starter?: string
  hints: string[]
  solution: string
  checklist: string[]
  pitfalls: string[]
}

export interface ExtraPractice {
  id: 'warmup' | 'stretch'
  title: string
  prompt: string
  hints: string[]
  solution: string
  checklist: string[]
}

export interface Lesson extends LessonCore {
  prerequisites: string[]
  prerequisiteNotes: string
  walkthrough: TeachingSection[]
  extraPractice: ExtraPractice[]
  followUps: { question: string; answer: string }[]
  takeaways: string[]
  /** Language-track lessons: target level, core path tags and lab language (the lab itself loads lazily). */
  level?: 'se' | 'sse'
  paths?: PathTag[]
  lang?: LabLanguage
}

export interface LabTest { args: unknown[]; expected: unknown }

/** A runnable exercise. `id` matches the practice stage it powers. */
export interface LabExercise {
  id: 'core' | 'warmup' | 'stretch'
  function: string
  starter: string
  solution: string
  tests: LabTest[]
  hiddenTests: LabTest[]
  /**
   * TypeScript labs only: type-level assertions compiled after the learner's code (never run). Every line must
   * type-check, and each `// @ts-expect-error` line must really be an error, so the checks prove the types are right.
   */
  typeChecks?: string
}

/** One SQL test case: seed rows inserted after the schema, and the exact result table expected. */
export interface SqlLabTest {
  name: string
  seed: string
  expected: { columns: string[]; rows: unknown[][] }
}

/**
 * A runnable SQL exercise on in-browser Postgres. Each case starts from a fresh database: `schema`, then the
 * case seed, then the learner's SQL. The last statement that returns rows (or the `check` query) is compared.
 */
export interface SqlExercise {
  id: 'core' | 'warmup' | 'stretch'
  schema: string
  starter: string
  solution: string
  /** Rows must come back in this order (the task asks for ORDER BY). */
  ordered?: boolean
  /** Query run after the learner's SQL, for tasks that change data or schema rather than select. */
  check?: string
  tests: SqlLabTest[]
  hiddenTests: SqlLabTest[]
}

export type AnyLabExercise = LabExercise | SqlExercise
export function isSqlExercise(exercise: AnyLabExercise): exercise is SqlExercise {
  return 'schema' in exercise
}

/** "Predict the output" item. `choices[answer]` is the exact printed output. */
export interface PredictItem {
  code: string
  choices: string[]
  answer: number
  explain: string
}

export interface LessonLab {
  lang: LabLanguage
  diagrams: Diagram[]
  exercises: AnyLabExercise[]
  predict: PredictItem[]
  tip: string
  links: { problems?: string[]; guides?: string[]; lessons?: string[] }
}

/** Skip-ahead question in a language track. A right answer marks `lessons` as known. */
export interface PlacementQuestion {
  question: string
  code?: string
  choices: string[]
  answer: number
  explain: string
  lessons: string[]
}

export interface TrackInfo {
  id: Track
  title: string
  description: string
  kind?: 'language'
  placement?: PlacementQuestion[]
}
