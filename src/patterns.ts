import type { PatternPage, PatternSummary } from './pattern-types'
import index from './generated/pattern-index.json' with { type: 'json' }
import { seeded } from './mocks'

export type { PatternPage, PatternSummary } from './pattern-types'

// Built from content/patterns/*.json by scripts/build-content.mjs. The index is small and eager;
// full pages (code, diagrams, exercises, quizzes) load lazily as one chunk that the service worker precaches.
export const patternIndex = index as PatternSummary[]
export const patternIds = new Set(patternIndex.map(item => item.id))

let cache: Promise<Map<string, PatternPage>> | undefined
export function loadPatterns(): Promise<Map<string, PatternPage>> {
  cache ??= import('./generated/patterns.json').then(module => new Map((module.default as unknown as PatternPage[]).map(item => [item.id, item])))
  return cache
}

/** Top-level pages in learning order, each with its sub-pattern pages. */
export function patternTree(pages: readonly PatternSummary[] = patternIndex): { page: PatternSummary; children: PatternSummary[] }[] {
  return pages.filter(page => !page.parent).map(page => ({ page, children: pages.filter(child => child.parent === page.id) }))
}

/** Pattern pages that teach a problem: listed on the page, or matching its sub-pattern, else its category. */
export function patternsForProblem(problem: { id: string; pattern: string; subpattern?: string }, pages: readonly PatternSummary[] = patternIndex): PatternSummary[] {
  const listed = pages.filter(page => page.problems.some(link => link.id === problem.id))
  const sub = problem.subpattern ? pages.filter(page => page.id === problem.subpattern) : []
  const category = pages.filter(page => page.category === problem.pattern && !page.parent)
  const all = [...sub, ...listed, ...category]
  return all.filter((page, i) => all.findIndex(other => other.id === page.id) === i)
}

export const PICKER_ROUND = 10

export interface PickerQuestion {
  /** A short problem statement. */
  prompt: string
  /** Page id of the right answer. */
  answer: string
  /** Page ids offered as choices, in display order. */
  choices: string[]
  /** Why: the first recognition signal of the right page. */
  explain: string
}

/** A deterministic round of "which pattern?" drills built from published pages. */
export function pickerRound(seed: number, pages: readonly PatternSummary[] = patternIndex, size = PICKER_ROUND): PickerQuestion[] {
  if (pages.length < 2) return []
  const random = seeded(seed)
  const drills = pages.flatMap(page => page.drills.map(prompt => ({ prompt, page })))
  const shuffled = [...drills]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const seen = new Set<string>()
  const picked = shuffled.filter(item => !seen.has(item.prompt) && seen.add(item.prompt)).slice(0, size)
  return picked.map(({ prompt, page }) => ({
    prompt,
    answer: page.id,
    choices: pages.map(item => item.id),
    explain: `${page.title}: ${page.signals[0].see} ${page.signals[0].think}`,
  }))
}

/** Number of right answers in a picker round. */
export function pickerScore(questions: readonly PickerQuestion[], answers: readonly (string | undefined)[]): number {
  return questions.filter((question, i) => answers[i] === question.answer).length
}
