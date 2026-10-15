import type { FieldGuideEntry, GuideSummary } from './guide-types'
import index from './generated/guide-index.json' with { type: 'json' }

export type { FieldGuideEntry, GuideSummary } from './guide-types'

// Built from content/field-guide/*.json by scripts/build-content.mjs. The index is small and eager;
// full entries (text, diagrams, quizzes) load lazily as one chunk that the service worker precaches.
export const guideIndex = index as GuideSummary[]
export const guideIds = new Set(guideIndex.map(item => item.id))

let cache: Promise<Map<string, FieldGuideEntry>> | undefined
export function loadGuides(): Promise<Map<string, FieldGuideEntry>> {
  cache ??= import('./generated/guides.json').then(module => new Map((module.default as unknown as FieldGuideEntry[]).map(item => [item.id, item])))
  return cache
}

/** Quiz score as a whole percentage. */
export function quizScore(answers: (number | undefined)[], entry: Pick<FieldGuideEntry, 'quiz'>): number {
  if (!entry.quiz.length) return 0
  const right = entry.quiz.filter((item, i) => answers[i] === item.answer).length
  return Math.round(right / entry.quiz.length * 100)
}
