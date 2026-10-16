import { SQL_TOPICS } from './problem-types'
import type { SqlProblem, SqlProblemSummary, SqlTopic } from './problem-types'
import index from './generated/sql-problem-index.json' with { type: 'json' }

export type { SqlProblem, SqlProblemSummary, SqlTopic } from './problem-types'

// Built from content/sql-problems/*.json by scripts/build-content.mjs. The index is eager; full problems load lazily.
export const sqlProblemIndex = index as SqlProblemSummary[]
export const sqlProblemIds = new Set(sqlProblemIndex.map(problem => problem.id))

let cache: Promise<Map<string, SqlProblem>> | undefined
export function loadSqlProblems(): Promise<Map<string, SqlProblem>> {
  cache ??= import('./generated/sql-problems.json').then(module => new Map((module.default as SqlProblem[]).map(problem => [problem.id, problem])))
  return cache
}

/** Topics that have problems, in canonical order. */
export function sqlTopics(): SqlTopic[] {
  const used = new Set(sqlProblemIndex.map(problem => problem.topic))
  return SQL_TOPICS.filter(topic => used.has(topic))
}

export interface TopicProgress { topic: SqlTopic; solved: number; total: number }

export function sqlTopicProgress(progress: { sqlSolved?: Record<string, string> }, items: SqlProblemSummary[] = sqlProblemIndex): TopicProgress[] {
  return sqlTopics().map(topic => {
    const subset = items.filter(problem => problem.topic === topic)
    return { topic, total: subset.length, solved: subset.filter(problem => progress.sqlSolved?.[problem.id]).length }
  }).filter(row => row.total > 0)
}
