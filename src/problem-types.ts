/** Canonical pattern order for lists, filters, progress and badges. */
export const PROBLEM_PATTERNS = ['Arrays & hashing', 'Two pointers', 'Sliding window', 'Stack', 'Binary search', 'Linked lists', 'Trees', 'Tries', 'Heaps', 'Graphs', 'Backtracking', 'Dynamic programming', 'Greedy', 'Intervals', 'Bit manipulation', 'Design & concurrency'] as const
export type ProblemPattern = typeof PROBLEM_PATTERNS[number]

export type ProblemLevel = 'se' | 'sse'
export type ProblemDifficulty = 'warm-up' | 'core' | 'stretch'
export type CodeLanguage = 'js' | 'py'

export interface ProblemTest {
  args: unknown[]
  expected: unknown
}

/** Small, eagerly loaded entry used by lists, progress and backup validation. */
export interface ProblemSummary {
  id: string
  title: string
  pattern: string
  level: ProblemLevel
  difficulty: ProblemDifficulty
  lessonId?: string
  /** Learning paths that treat this problem as core practice. */
  paths?: ('swe' | 'senior')[]
}

export interface Problem extends ProblemSummary {
  prompt: string
  function: Record<CodeLanguage, string>
  starter: Record<CodeLanguage, string>
  tests: ProblemTest[]
  hiddenTests: ProblemTest[]
  hints: string[]
  solution: Record<CodeLanguage, string> & { explanation: string }
  complexity: { time: string; space: string; notes: string }
  followUps: string[]
}
