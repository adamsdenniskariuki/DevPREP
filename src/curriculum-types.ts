import type { Diagram } from './guide-types'

export type Track = 'dsa' | 'system-design' | 'ml' | 'ai' | 'behavioral' | 'python'
/** Language tracks teach one programming language; lessons there carry a runnable lab. */
export type LabLanguage = 'py' | 'ts'
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
  exercises: LabExercise[]
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
