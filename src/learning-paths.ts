import pathsData from '../content/paths.json' with { type: 'json' }
import { lessons } from './curriculum'
import type { Progress } from './progress'

export type PathId = 'swe' | 'senior'

export interface PathPhase {
  title: string
  objective: string
  lessonIds: string[]
}

export interface PathPrompt {
  lessonId: string
  title: string
  prompt: string
  rubric: string[]
  discussion: string
}

export interface LearningPath {
  id: PathId
  title: string
  shortTitle: string
  audience: string
  emphasis: string
  outcomes: string[]
  phases: PathPhase[]
  prompts: PathPrompt[]
}

export const learningPaths = pathsData as LearningPath[]

export function isPathId(value: unknown): value is PathId {
  return value === 'swe' || value === 'senior'
}

export function getLearningPath(id: PathId | undefined): LearningPath | undefined {
  return learningPaths.find(path => path.id === id)
}

export function pathLessonIds(path: LearningPath): string[] {
  return path.phases.flatMap(phase => phase.lessonIds)
}

export function pathProgress(path: LearningPath, progress: Pick<Progress, 'records'>) {
  const ids = pathLessonIds(path)
  const completed = ids.filter(id => Object.hasOwn(progress.records, id)).length
  return { completed, total: ids.length, percent: Math.round(completed / ids.length * 100) }
}

export function nextLessonFor(progress: Pick<Progress, 'records' | 'selectedPath'>) {
  const path = getLearningPath(progress.selectedPath)
  if (!path) return lessons.find(lesson => !Object.hasOwn(progress.records, lesson.id))
  const id = pathLessonIds(path).find(id => !Object.hasOwn(progress.records, id))
  return lessons.find(lesson => lesson.id === id)
}

export function selectPath(progress: Progress, id: PathId | undefined): Progress {
  const next = { ...progress }
  if (id === undefined) delete next.selectedPath
  else next.selectedPath = id
  return next
}
