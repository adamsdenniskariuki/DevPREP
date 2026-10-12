import { PROBLEM_PATTERNS } from './problem-types'
import type { Problem, ProblemSummary } from './problem-types'
import type { Progress } from './progress'
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

/** Patterns that have problems, in canonical order. */
export function problemPatterns(): string[] {
  const used = new Set(problemIndex.map(problem => problem.pattern))
  return PROBLEM_PATTERNS.filter(pattern => used.has(pattern))
}

export interface PatternProgress { pattern: string; solved: number; total: number }

export function patternProgress(progress: Pick<Progress, 'solved'>, items: ProblemSummary[] = problemIndex): PatternProgress[] {
  return problemPatterns().map(pattern => {
    const subset = items.filter(problem => problem.pattern === pattern)
    return { pattern, total: subset.length, solved: subset.filter(problem => progress.solved?.[problem.id]).length }
  }).filter(row => row.total > 0)
}

/** True when a problem is marked core on the given role path. */
export function isPathCore(problem: Pick<ProblemSummary, 'paths'>, path: string | undefined): boolean {
  return !!path && (problem.paths ?? []).includes(path as 'swe' | 'senior')
}
