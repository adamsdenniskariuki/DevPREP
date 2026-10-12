import type { RubricItem } from './case-types'

/** 0 = missed, 1 = partly, 2 = covered. */
export type RubricMark = 0 | 1 | 2

/** SSE rubric items count only for SSE cases or when the learner targets the senior role. */
export function scoredItems(rubric: RubricItem[], includeSse: boolean): number[] {
  return rubric.flatMap((item, index) => !item.sse || includeSse ? [index] : [])
}

/** Whole percentage of available rubric points, or undefined until every scored item is marked. */
export function rubricPercent(rubric: RubricItem[], marks: (RubricMark | undefined)[], includeSse: boolean): number | undefined {
  const items = scoredItems(rubric, includeSse)
  if (!items.length || items.some(index => marks[index] === undefined)) return undefined
  const points = items.reduce((sum, index) => sum + marks[index]!, 0)
  return Math.round(points / (items.length * 2) * 100)
}
