import type { Problem, ProblemSummary } from './problem-types'
import index from './generated/problem-index.json' with { type: 'json' }

export type { CodeLanguage, Problem, ProblemSummary, ProblemTest } from './problem-types'

// Built from content/problems/*.json by scripts/build-content.mjs. The summary index is
// small and eager; full problems (statements, tests, solutions) load lazily as one chunk.
export const problemIndex = index as ProblemSummary[]
export const problemIds = new Set(problemIndex.map(problem => problem.id))

let cache: Promise<Map<string, Problem>> | undefined
export function loadProblems(): Promise<Map<string, Problem>> {
  cache ??= import('./generated/problems.json').then(module => new Map((module.default as Problem[]).map(problem => [problem.id, problem])))
  return cache
}

export function problemPatterns(): string[] {
  return [...new Set(problemIndex.map(problem => problem.pattern))]
}
