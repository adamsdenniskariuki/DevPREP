import type { PlacementQuestion } from './curriculum-types'

/**
 * Scores a placement check. A lesson counts as known only when every question that covers it was
 * answered correctly, so one lucky guess cannot skip a lesson another question shows you need.
 */
export function placementResult(questions: PlacementQuestion[], answers: (number | undefined)[]): { percent: number; known: string[] } {
  const right = questions.map((question, index) => answers[index] === question.answer)
  const percent = questions.length ? Math.round(right.filter(Boolean).length / questions.length * 100) : 0
  const lessons = [...new Set(questions.flatMap(question => question.lessons))]
  const known = lessons.filter(id => questions.every((question, index) => !question.lessons.includes(id) || right[index]))
  return { percent, known }
}