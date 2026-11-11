import type { ProjectLanguage, ProjectReport, RunPhase, RunProgress } from './runner/runner'
import type { ProjectRunRequest } from './runner/project'
import { formatProjectDiagnostic } from './runner/project'

/** A timed TypeScript coding task for the TypeScript skill test (content/typescript-tasks). */
export interface TypeScriptTask {
  id: string
  title: string
  /** The TypeScript curriculum lesson this task practises. */
  lesson: string
  minutes: number
  summary: string
  prompt: string
  hints: string[]
  starter: string
  solution: string
  /** The checking tests (index.test.ts), shown read-only. */
  tests: string
}

let cache: Promise<TypeScriptTask[]> | undefined
/** The tasks, built from content/typescript-tasks by scripts/build-content.mjs. */
export function loadTypeScriptTasks(): Promise<TypeScriptTask[]> {
  cache ??= import('./generated/typescript-tasks.json').then(module => module.default as unknown as TypeScriptTask[])
  return cache
}

export const TYPESCRIPT_TASK_FILE = 'index.ts'
export const TYPESCRIPT_TASK_TEST_FILE = 'index.test.ts'

/** How many results a run reports: every exported test* function, plus the type check. */
export const typeScriptTaskCount = (tests: string) => (tests.match(/^export\s+(?:async\s+)?function\s+test\w*/gm)?.length ?? 0) + 1

type ProjectRunner = (lang: ProjectLanguage, request: ProjectRunRequest, onPhase?: (phase: RunPhase) => void, onProgress?: RunProgress) => Promise<ProjectReport>

/**
 * Runs a task as a two-file TypeScript project and adds a "Type check" result, so code that passes the tests
 * but has a type error still fails: in a TypeScript test the types are part of the answer.
 */
export async function runTypeScriptTask(runProject: ProjectRunner, code: string, tests: string, options: { onPhase: (phase: RunPhase) => void; onTotal: (total: number) => void; onProgress: RunProgress }): Promise<ProjectReport> {
  options.onTotal(typeScriptTaskCount(tests))
  const report = await runProject('ts', { files: { [TYPESCRIPT_TASK_FILE]: code, [TYPESCRIPT_TASK_TEST_FILE]: tests }, tests: [TYPESCRIPT_TASK_TEST_FILE] }, options.onPhase, options.onProgress)
  return withTypeCheck(report)
}

/** Appends a passing or failing "Type check" outcome to a finished run. */
export function withTypeCheck(report: ProjectReport): ProjectReport {
  if (report.kind !== 'done') return report
  const errors = report.diagnostics ?? []
  const outcome = errors.length
    ? { name: 'Type check', file: TYPESCRIPT_TASK_FILE, pass: false, error: errors.slice(0, 5).map(formatProjectDiagnostic).join('\n'), ms: 0 }
    : { name: 'Type check', file: TYPESCRIPT_TASK_FILE, pass: true, ms: 0 }
  return { ...report, outcomes: [...report.outcomes, outcome] }
}
