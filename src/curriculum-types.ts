export type Track = 'dsa' | 'system-design' | 'ml' | 'behavioral'

export interface TeachingSection {
  title: string
  body: string
  code?: string
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
}
