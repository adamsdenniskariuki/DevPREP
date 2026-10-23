/** Canonical pattern order for lists, filters, progress and badges. */
export const PROBLEM_PATTERNS = ['Arrays & hashing', 'Two pointers', 'Sliding window', 'Stack', 'Binary search', 'Linked lists', 'Trees', 'Tries', 'Heaps', 'Graphs', 'Backtracking', 'Dynamic programming', 'Greedy', 'Intervals', 'Bit manipulation', 'Design & concurrency', 'Prefix sums', 'Cyclic sort', 'Matrix traversal', 'Quickselect & divide and conquer'] as const
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
  /** Pattern page id when the problem teaches a sub-pattern of its category. */
  subpattern?: string
}

/** Topic order for the SQL interview problem set (lists, filters, progress and badges). */
export const SQL_TOPICS = ['Filtering & joins', 'Aggregation', 'Subqueries & CTEs', 'Window functions', 'Gaps & islands', 'Data changes & design'] as const
export type SqlTopic = typeof SQL_TOPICS[number]

/** Small, eagerly loaded entry for one SQL interview problem. */
export interface SqlProblemSummary {
  id: string
  title: string
  topic: SqlTopic
  level: ProblemLevel
  difficulty: ProblemDifficulty
  /** SQL lesson that teaches the idea. */
  lessonId?: string
  paths?: ('swe' | 'senior')[]
}

/** A runnable SQL interview problem on in-browser Postgres, checked like a SQL lab exercise. */
export interface SqlProblem extends SqlProblemSummary {
  prompt: string
  hints: string[]
  exercise: {
    schema: string
    starter: string
    solution: string
    ordered?: boolean
    check?: string
    tests: { name: string; seed: string; expected: { columns: string[]; rows: unknown[][] } }[]
    hiddenTests: { name: string; seed: string; expected: { columns: string[]; rows: unknown[][] } }[]
  }
  /** Why the solution works, in prose. */
  explanation: string
  /** Performance, indexing or scale note an interviewer would probe. */
  notes: string
  followUps: string[]
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
