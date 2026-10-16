import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/sql-problem-ids.json' with { type: 'json' }
import { validateSqlProblem } from './content-schema'
import { lessons } from './curriculum'
import { cardIds } from './flashcards'
import { gameStats, patternSlug, sqlSolveXp } from './gamification'
import { buildMock } from './mocks'
import { sqlProblemQueue } from './planner'
import { emptyProgress, parseBackup, recordSqlSolve, serializeBackup, updateProfile } from './progress'
import { SQL_TOPICS, type SqlProblem } from './problem-types'
import { loadSqlProblems, sqlProblemIndex, sqlTopicProgress } from './sql-problems'
import { resetDb, runSql, type SqlDb } from './runner/sql-core'

const dir = 'content/sql-problems'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json')
const problems = files.map(name => read(join(dir, name)) as SqlProblem)
const fresh = () => emptyProgress(new Date('2025-01-01T00:00:00Z'))

describe('SQL problem content', () => {
  it('index.json lists exactly the problem files, in a stable order', () => {
    const { problems: order } = read(join(dir, 'index.json')) as { problems: string[] }
    expect([...order].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
    expect(sqlProblemIndex.map(problem => problem.id)).toEqual(order)
  })

  it.each(files)('%s is valid and its id matches the file', name => {
    const problem = read(join(dir, name)) as SqlProblem
    expect(validateSqlProblem(problem, name)).toEqual([])
    expect(problem.id).toBe(name.replace(/\.json$/, ''))
    const names = [...problem.exercise.tests, ...problem.exercise.hiddenTests].map(test => test.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('links only to SQL lessons that exist', () => {
    const ids = new Set(lessons.filter(lesson => lesson.track === 'sql').map(lesson => lesson.id))
    expect(problems.filter(problem => problem.lessonId && !ids.has(problem.lessonId)).map(problem => problem.id)).toEqual([])
  })

  it('gives every topic Easy, Medium and Hard problems at both levels', () => {
    expect(problems.length).toBeGreaterThanOrEqual(40)
    for (const topic of SQL_TOPICS) {
      const subset = problems.filter(problem => problem.topic === topic)
      expect([...new Set(subset.map(problem => problem.difficulty))].sort(), topic).toEqual(['core', 'stretch', 'warm-up'])
    }
    expect(problems.filter(problem => problem.level === 'sse').length).toBeGreaterThan(5)
  })

  it('marks path-core problems so the SE path only needs SE-level problems', () => {
    for (const problem of sqlProblemIndex.filter(item => item.paths?.includes('swe'))) expect(problem.level, problem.id).toBe('se')
    expect(sqlProblemIndex.filter(item => item.paths?.includes('swe')).length).toBeGreaterThan(5)
    expect(sqlProblemIndex.filter(item => item.paths?.includes('senior')).length).toBeGreaterThan(5)
  })

  it('lazy-loads the same problems the index lists', async () => {
    const loaded = await loadSqlProblems()
    expect([...loaded.keys()]).toEqual(sqlProblemIndex.map(problem => problem.id))
  })

  it('makes one flashcard per problem', () => {
    for (const problem of problems) expect(cardIds.has(`sql-p-${problem.id}`), problem.id).toBe(true)
  })

  it('rejects malformed problems with readable errors', () => {
    expect(validateSqlProblem({ id: 'Bad', topic: 'Sorting', lessonId: 'arrays', hints: ['a'] })).toEqual(expect.arrayContaining([
      'sql problem.id: expected kebab-case id',
      'sql problem.topic: expected a known SQL topic',
      'sql problem.lessonId: expected a SQL lesson id',
      'sql problem: missing "exercise"',
    ]))
  })
})

// SQL problem IDs are stored in backups (the "sqlSolved" map). Append-only, like lesson IDs.
describe('SQL problem id registry', () => {
  const current = new Set(problems.map(problem => problem.id))
  it('keeps every SQL problem id that has ever shipped', () => expect(knownIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current SQL problem id', () => expect([...current].filter(id => !knownIds.includes(id))).toEqual([]))
})

describe('SQL problem solutions (PGlite)', () => {
  let db: SqlDb
  beforeAll(async () => {
    db = await PGlite.create() as unknown as SqlDb
    await resetDb(db)
  }, 120_000)

  it.each(problems.map(problem => [problem.id, problem] as const))('%s: the solution passes every test and the starter fails one', async (_id, problem) => {
    const { exercise } = problem
    const request = { schema: exercise.schema, check: exercise.check, ordered: exercise.ordered }
    const cases = [...exercise.tests, ...exercise.hiddenTests]
    const result = await runSql(db, { ...request, code: exercise.solution, cases })
    expect(result).toMatchObject({ kind: 'done' })
    if (result.kind === 'done') expect(result.outcomes.map((outcome, index) => ({ name: cases[index].name, pass: outcome.pass, reason: outcome.reason, error: outcome.error })).filter(outcome => !outcome.pass)).toEqual([])
    const starter = await runSql(db, { ...request, code: exercise.starter, cases: exercise.tests })
    if (starter.kind === 'done') expect(starter.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})

describe('SQL problems in progress, gamification, mocks and the plan', () => {
  const first = sqlProblemIndex[0]

  it('records a first solve once and keeps it through a backup round-trip', () => {
    const solved = recordSqlSolve(fresh(), first.id, new Date('2025-01-02T10:00:00Z'))
    expect(solved.sqlSolved).toEqual({ [first.id]: '2025-01-02T10:00:00.000Z' })
    expect(recordSqlSolve(solved, first.id, new Date('2025-02-01T00:00:00Z'))).toBe(solved)
    expect(parseBackup(serializeBackup(solved)).sqlSolved).toEqual(solved.sqlSolved)
    expect(() => recordSqlSolve(fresh(), 'no-such-problem')).toThrow()
    const tampered = JSON.parse(serializeBackup(solved))
    tampered.sqlSolved = { 'no-such-problem': '2025-01-02T10:00:00.000Z' }
    expect(() => parseBackup(JSON.stringify(tampered))).toThrow()
    expect(parseBackup(serializeBackup(fresh())).sqlSolved).toBeUndefined()
  })

  it('awards XP, a first-solve badge and per-topic badges', () => {
    const badge = (progress: ReturnType<typeof fresh>, id: string) => gameStats(progress).badges.find(item => item.id === id)
    const solved = recordSqlSolve(fresh(), first.id)
    expect(sqlSolveXp(solved)).toBeGreaterThan(0)
    expect(gameStats(solved).xp).toBeGreaterThan(gameStats(fresh()).xp)
    expect(badge(fresh(), 'first-sql-solve')?.earned).toBe(false)
    expect(badge(solved, 'first-sql-solve')?.earned).toBe(true)
    const topic = first.topic
    const slug = patternSlug(topic)
    const all = sqlProblemIndex.filter(problem => problem.topic === topic).reduce((progress, problem) => recordSqlSolve(progress, problem.id), fresh())
    expect(sqlTopicProgress(all).find(row => row.topic === topic)).toMatchObject({ solved: expect.any(Number) })
    expect(badge(all, `sql-topic-${slug}`)?.earned).toBe(true)
    expect(badge(fresh(), `sql-topic-${slug}`)?.earned).toBe(false)
  })

  it('queues SQL problems only once the SQL track is opted in, path-core first and SE-level on the SE path', () => {
    expect(sqlProblemQueue(fresh())).toEqual([])
    const se = sqlProblemQueue(updateProfile(fresh(), { focusTracks: ['sql'] }))
    expect(se.length).toBeGreaterThan(0)
    expect(se.every(problem => problem.level === 'se')).toBe(true)
    expect(se[0].paths?.includes('swe')).toBe(true)
    const senior = sqlProblemQueue({ ...updateProfile(fresh(), { focusTracks: ['sql'] }), selectedPath: 'senior' })
    expect(senior.some(problem => problem.level === 'sse')).toBe(true)
    const solved = recordSqlSolve(updateProfile(fresh(), { focusTracks: ['sql'] }), se[0].id)
    expect(sqlProblemQueue(solved).map(problem => problem.id)).not.toContain(se[0].id)
  })

  it('opens SQL mocks with an interview problem at the right level', async () => {
    const sqlProblems = await loadSqlProblems()
    const labs = new Map()
    for (const seed of [1, 2, 3, 4, 5]) {
      const se = buildMock('sql', 'se', seed, { problems: new Map(), cases: new Map(), labs, sqlProblems })
      expect(se.questions[0]).toMatchObject({ kind: 'sql' })
      expect(sqlProblems.get(se.questions[0].ref)?.level).toBe('se')
      const sse = buildMock('sql', 'sse', seed, { problems: new Map(), cases: new Map(), labs, sqlProblems })
      expect(sqlProblems.get(sse.questions[0].ref)?.difficulty).not.toBe('warm-up')
    }
  })
})
