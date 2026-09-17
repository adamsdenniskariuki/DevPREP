import type { Lesson } from './curriculum-types'

export type LessonSection =
  | { id: string; kind: 'overview' | 'example' | 'pitfalls' | 'takeaways'; title: string }
  | { id: string; kind: 'concept' | 'walkthrough'; title: string; index: number }

export function lessonSections(lesson: Lesson): LessonSection[] {
  return [
    { id: 'overview', kind: 'overview', title: 'Objectives & prerequisites' },
    ...lesson.concepts.map((concept, index) => ({
      id: `concept-${index}`, kind: 'concept' as const, title: concept.title, index,
    })),
    { id: 'example', kind: 'example', title: 'Worked example' },
    ...lesson.walkthrough.map((step, index) => ({
      id: `walkthrough-${index}`, kind: 'walkthrough' as const, title: step.title, index,
    })),
    { id: 'pitfalls', kind: 'pitfalls', title: 'Pitfalls & edge cases' },
    { id: 'takeaways', kind: 'takeaways', title: 'Key takeaways' },
  ]
}
