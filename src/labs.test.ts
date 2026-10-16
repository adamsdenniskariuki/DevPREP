import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { isLanguageTrack, lessons, loadLabs, tracks, type LessonLab } from './curriculum'
import { isSqlExercise, type LabExercise } from './curriculum-types'
import { gameStats } from './gamification'
import { buildMock, MOCK_MINUTES, TRIVIA_ROUNDS } from './mocks'
import { placementResult } from './placement'
import { lessonQueue } from './planner'
import { emptyProgress, parseBackup, recordMock, recordPlacement, serializeBackup, updateProfile, type Progress } from './progress'
import { problemIndex } from './problems'
import { PY_HARNESS, runJsAsync, runPython } from './runner/core'
import { checkWithTypeChecks, createTsCompiler, formatDiagnostic, libClosure } from './runner/ts-core'
import { TYPESCRIPT_VERSION } from './runner/ts-version'
import { PGLITE_VERSION } from './runner/pglite-version'
import { compareTables, predictOutput, resetDb, runSql, type SqlDb } from './runner/sql-core'

const labs = await loadLabs()
const labLessons = lessons.filter(lesson => isLanguageTrack(lesson.track))
const pyLabs = labLessons.filter(lesson => labs.get(lesson.id)?.lang === 'py').map(lesson => [lesson.id, labs.get(lesson.id)!] as const)
const tsLabs = labLessons.filter(lesson => labs.get(lesson.id)?.lang === 'ts').map(lesson => [lesson.id, labs.get(lesson.id)!] as const)
const sqlLabs = labLessons.filter(lesson => labs.get(lesson.id)?.lang === 'sql').map(lesson => [lesson.id, labs.get(lesson.id)!] as const)
const codeExercises = (lab: LessonLab) => lab.exercises.filter((exercise): exercise is LabExercise => !isSqlExercise(exercise))
const guideIds = new Set(readdirSync('content/field-guide').map(file => file.replace(/\.json$/, '')))
const problemIds = new Set(problemIndex.map(problem => problem.id))
const lessonIds = new Set(lessons.map(lesson => lesson.id))

describe('language labs', () => {
  it('ship a lab for every language lesson and none for interview lessons', () => {
    expect(labLessons.length).toBeGreaterThan(0)
    for (const lesson of lessons) expect(labs.has(lesson.id), lesson.id).toBe(isLanguageTrack(lesson.track))
    for (const lesson of labLessons) expect(lesson.lang).toBe(labs.get(lesson.id)!.lang)
  })

  it.each(labLessons.map(lesson => [lesson.id, labs.get(lesson.id)!] as const))('%s links only to content that exists', (_id, lab: LessonLab) => {
    for (const id of lab.links.problems ?? []) expect(problemIds.has(id), id).toBe(true)
    for (const id of lab.links.guides ?? []) expect(guideIds.has(id), id).toBe(true)
    for (const id of lab.links.lessons ?? []) expect(lessonIds.has(id), id).toBe(true)
  })

  it('has a placement check that covers every lesson of each language track', () => {
    for (const track of tracks.filter(item => item.kind === 'language')) {
      const covered = new Set(track.placement!.flatMap(question => question.lessons))
      expect(lessons.filter(lesson => lesson.track === track.id && !covered.has(lesson.id)).map(lesson => lesson.id), track.id).toEqual([])
      const perfect = placementResult(track.placement!, track.placement!.map(question => question.answer))
      expect(perfect.percent).toBe(100)
      expect(new Set(perfect.known)).toEqual(covered)
      expect(placementResult(track.placement!, track.placement!.map(() => -1))).toEqual({ percent: 0, known: [] })
    }
  })
})

describe('Python labs (Pyodide)', () => {
  let py: PyodideAPI
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    py.runPython(PY_HARNESS)
  }, 120_000)

  it.each(pyLabs)('%s: every solution passes its tests and every starter fails one', (_id, lab) => {
    for (const exercise of codeExercises(lab)) {
      const cases = [...exercise.tests, ...exercise.hiddenTests]
      const result = runPython(py, { code: exercise.solution, name: exercise.function, cases })
      expect(result, exercise.id).toMatchObject({ kind: 'done' })
      if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass), exercise.id).toEqual([])
      const starter = runPython(py, { code: exercise.starter, name: exercise.function, cases: exercise.tests })
      expect(starter.kind, exercise.id).toBe('done')
      if (starter.kind === 'done') expect(starter.outcomes.some(outcome => !outcome.pass), exercise.id).toBe(true)
    }
  })

  it.each(pyLabs)('%s: every predict-the-output answer is what Python prints', (_id, lab) => {
    for (const item of lab.predict) {
      let output = ''
      py.setStdout({ batched: text => { output += `${text}\n` } })
      try { py.runPython(item.code, { globals: py.toPy({}) }) } finally { py.setStdout({}) }
      expect(output.trim()).toBe(item.choices[item.answer])
    }
  })
})

describe('TypeScript labs (compiler + runner)', () => {
  const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
  const compiler = createTsCompiler(ts, Object.fromEntries(libClosure(read).map(name => [name, read(name)])))

  it('pins the served compiler to the installed typescript package', () => {
    expect(ts.version).toBe(TYPESCRIPT_VERSION)
    expect(compiler.check('const n: number = "x"').map(diagnostic => diagnostic.code)).toEqual([2322])
    expect(compiler.check('console.log([1, 2].at(-1)); setTimeout(() => {}, 0)')).toEqual([])
  })

  it('awaits promise results and fails promises that never settle', async () => {
    const code = compiler.transpile('function later(n: number): Promise<number> { return new Promise(done => setTimeout(() => done(n * 2), 5)) }\nfunction never(): Promise<number> { return new Promise(() => {}) }')
    expect(await runJsAsync({ code, name: 'later', cases: [{ args: [4], expected: 8 }] })).toMatchObject({ kind: 'done', outcomes: [{ pass: true }] })
    const stuck = await runJsAsync({ code, name: 'never', cases: [{ args: [], expected: 1 }] }, 50)
    expect(stuck).toMatchObject({ kind: 'done', outcomes: [{ pass: false }] })
  })

  it('splits type-check failures from learner diagnostics, including unused @ts-expect-error lines', () => {
    const checks = 'type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false\ntype Expect<T extends true> = T\ntype _a = Expect<Equal<ReturnType<typeof pick>, number>>\n// @ts-expect-error pick takes a number\npick("x")'
    const good = checkWithTypeChecks(compiler.check, 'function pick(n: number): number { return n }', checks)
    expect(good).toEqual({ diagnostics: [], typeChecks: { pass: true, errors: [] } })
    const loose = checkWithTypeChecks(compiler.check, 'const bad: number = "x"\nfunction pick(n: any): any { return n }', checks)
    expect(loose.diagnostics.map(diagnostic => [diagnostic.line, diagnostic.code])).toEqual([[1, 2322]])
    expect(loose.typeChecks?.pass).toBe(false)
    expect(loose.typeChecks?.errors.map(error => [error.line, error.code])).toEqual([[3, 2344], [4, 2578]])
    expect(checkWithTypeChecks(compiler.check, 'const n = 1')).toEqual({ diagnostics: [], typeChecks: undefined })
  })

  it.each(tsLabs)('%s: every solution type-checks and passes its tests, and every starter fails one', async (_id, lab) => {
    for (const exercise of codeExercises(lab)) {
      expect(compiler.check(exercise.solution).map(formatDiagnostic), exercise.id).toEqual([])
      if (exercise.typeChecks) expect(checkWithTypeChecks(compiler.check, exercise.solution, exercise.typeChecks).typeChecks, exercise.id).toEqual({ pass: true, errors: [] })
      const cases = [...exercise.tests, ...exercise.hiddenTests]
      const result = await runJsAsync({ code: compiler.transpile(exercise.solution), name: exercise.function, cases })
      expect(result, exercise.id).toMatchObject({ kind: 'done' })
      if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass), exercise.id).toEqual([])
      const starter = await runJsAsync({ code: compiler.transpile(exercise.starter), name: exercise.function, cases: exercise.tests })
      expect(starter.kind, exercise.id).toBe('done')
      if (starter.kind === 'done') expect(starter.outcomes.some(outcome => !outcome.pass), exercise.id).toBe(true)
    }
  })

  it.each(tsLabs)('%s: every predict-the-output answer is what Node prints once timers drain', (_id, lab) => {
    for (const item of lab.predict) {
      const run = spawnSync(process.execPath, ['-'], { input: compiler.transpile(item.code), encoding: 'utf8', timeout: 10_000 })
      expect(run.stderr, item.code).toBe('')
      expect(run.stdout.trim(), item.code).toBe(item.choices[item.answer])
    }
  })
})

describe('SQL labs (PGlite)', () => {
  let db: SqlDb
  beforeAll(async () => {
    db = await PGlite.create() as unknown as SqlDb
    await resetDb(db)
  }, 120_000)

  it('pins the served Postgres to the installed package and resets fully between cases', async () => {
    const pkg = JSON.parse(readFileSync('node_modules/@electric-sql/pglite/package.json', 'utf8')) as { version: string }
    expect(pkg.version).toBe(PGLITE_VERSION)
    const schema = 'CREATE TABLE t (id int PRIMARY KEY, price numeric(6,2), at date, doc jsonb)'
    const expected = { columns: ['id', 'price', 'at', 'doc'], rows: [[1, 2.5, '2024-03-01', { k: [1] }], [2, null, null, null]] }
    const cases = [{ name: 'one', seed: `INSERT INTO t VALUES (1, 2.50, '2024-03-01', '{"k":[1]}'), (2, NULL, NULL, NULL)`, expected }]
    const good = await runSql(db, { code: 'SELECT * FROM t', schema, cases })
    expect(good).toMatchObject({ kind: 'done', outcomes: [{ pass: true }] })
    // A learner who leaves a transaction open, changes settings and adds schemas still gets a clean database next time.
    await runSql(db, { code: "BEGIN; CREATE SCHEMA junk; SET TimeZone = 'Asia/Tokyo'; CREATE TEMP TABLE x (i int); SELECT 1 AS one", schema, cases })
    expect(await runSql(db, { code: 'SELECT * FROM t', schema, cases })).toMatchObject({ kind: 'done', outcomes: [{ pass: true }] })
    expect(await predictOutput(db, "SELECT now()::date = current_date, current_setting('TimeZone'), (SELECT count(*) FROM pg_namespace WHERE nspname = 'junk')")).toBe('true | UTC | 0')
    const wrong = await runSql(db, { code: 'SELECT id FROM t', schema, cases })
    expect(wrong).toMatchObject({ kind: 'done', outcomes: [{ pass: false, reason: expect.stringContaining('columns') }] })
    const broken = await runSql(db, { code: 'SELECT * FROM nope', schema, cases })
    expect(broken).toMatchObject({ kind: 'done', outcomes: [{ pass: false, error: 'relation "nope" does not exist' }] })
    const changed = await runSql(db, { code: 'UPDATE t SET price = 3', schema, check: 'SELECT count(*) AS n FROM t WHERE price = 3', cases: [{ name: 'c', seed: cases[0].seed, expected: { columns: ['n'], rows: [[2]] } }] })
    expect(changed).toMatchObject({ kind: 'done', outcomes: [{ pass: true }] })
    expect(await predictOutput(db, 'SELECT 1/0')).toBe('ERROR: division by zero')
  })

  it('compares rows as a multiset unless order matters, with a numeric tolerance', () => {
    const expected = { columns: ['a', 'b'], rows: [[1, 'x'], [2, 'y']] }
    expect(compareTables(expected, { columns: ['a', 'b'], rows: [[2, 'y'], [1, 'x']] }).pass).toBe(true)
    expect(compareTables(expected, { columns: ['a', 'b'], rows: [[2, 'y'], [1, 'x']] }, true)).toEqual({ pass: false, reason: expect.stringContaining('ORDER BY') })
    expect(compareTables({ columns: ['avg'], rows: [[0.3333333333]] }, { columns: ['avg'], rows: [[1 / 3]] }).pass).toBe(true)
    expect(compareTables(expected, { columns: ['a', 'b'], rows: [[1, 'x'], [1, 'x']] }).pass).toBe(false)
    expect(compareTables(expected, { columns: ['a', 'b'], rows: [[1, 'x']] }).reason).toContain('Expected 2 rows')
  })

  it.each(sqlLabs)('%s: every solution passes its tests and every starter fails one', async (_id, lab) => {
    for (const exercise of lab.exercises) {
      if (!isSqlExercise(exercise)) throw new Error('SQL labs hold SQL exercises only')
      const request = { schema: exercise.schema, check: exercise.check, ordered: exercise.ordered }
      const result = await runSql(db, { ...request, code: exercise.solution, cases: [...exercise.tests, ...exercise.hiddenTests] })
      expect(result, exercise.id).toMatchObject({ kind: 'done' })
      if (result.kind === 'done') expect(result.outcomes.map((outcome, index) => ({ ...outcome, ms: 0, index })).filter(outcome => !outcome.pass), exercise.id).toEqual([])
      const starter = await runSql(db, { ...request, code: exercise.starter, cases: exercise.tests })
      if (starter.kind === 'done') expect(starter.outcomes.some(outcome => !outcome.pass), exercise.id).toBe(true)
    }
  })

  it.each(sqlLabs)('%s: every predict-the-output answer is what Postgres returns', async (_id, lab) => {
    for (const item of lab.predict) expect(await predictOutput(db, item.code), item.code).toBe(item.choices[item.answer])
  })
})

describe('language tracks in practice', () => {
  const languageTracks = tracks.filter(track => track.kind === 'language')

  it.each(languageTracks.map(track => [track.id, track] as const))('%s mocks are a coding task plus predict-the-output trivia', async (_id, track) => {
    const data = { problems: new Map(), cases: new Map(), labs }
    for (const level of ['se', 'sse'] as const) {
      const mock = buildMock(track.id, level, 7, data)
      expect(mock.minutes).toBe(MOCK_MINUTES[track.id])
      expect(mock.questions[0].kind).toBe('task')
      expect(lessons.find(lesson => lesson.id === mock.questions[0].ref)?.track).toBe(track.id)
      const trivia = mock.questions.filter(question => question.kind === 'trivia')
      expect(trivia.length).toBeGreaterThan(0)
      expect(trivia.length).toBeLessThanOrEqual(TRIVIA_ROUNDS)
      for (const question of trivia) {
        const item = labs.get(question.ref)!.predict.find(predict => predict.code === question.code)
        expect(item, question.ref).toBeDefined()
        expect(question.answer.startsWith(item!.choices[item!.answer])).toBe(true)
      }
      if (level === 'se') for (const question of mock.questions) expect(lessons.find(lesson => lesson.id === question.ref)?.level).not.toBe('sse')
    }
  })

  it.each(languageTracks.map(track => [track.id, track] as const))('%s joins the plan only once opted in, and placement skips known lessons', (_id, track) => {
    const trackIds = lessons.filter(lesson => lesson.track === track.id).map(lesson => lesson.id)
    const fresh = emptyProgress(new Date('2025-01-01T00:00:00Z'))
    expect(lessonQueue(fresh).filter(id => trackIds.includes(id))).toEqual([])
    const focused = updateProfile(fresh, { focusTracks: [track.id] })
    expect(lessonQueue(focused).filter(id => trackIds.includes(id))).toEqual(trackIds)
    const placed = recordPlacement(fresh, track.id, 50, [trackIds[0]])
    const queued = lessonQueue(placed).filter(id => trackIds.includes(id))
    expect(queued).toEqual(trackIds.slice(1))
  })

  it.each(languageTracks.map(track => [track.id, track] as const))('%s placement and trivia badges, and placement survives a backup round-trip', (_id, track) => {
    const fresh = emptyProgress(new Date('2025-01-01T00:00:00Z'))
    const badge = (progress: Progress, id: string) => gameStats(progress).badges.find(item => item.id === id)!
    expect(badge(fresh, `placed-${track.id}`).earned).toBe(false)
    expect(badge(fresh, `trivia-${track.id}`).earned).toBe(false)
    const first = lessons.find(lesson => lesson.track === track.id)!.id
    const placed = recordPlacement(fresh, track.id, 75, [first, first])
    expect(placed.placements?.[track.id]?.known).toEqual([first])
    expect(badge(placed, `placed-${track.id}`).earned).toBe(true)
    const mocked = recordMock(placed, { track: track.id, percent: 60, minutes: 10 })
    expect(badge(mocked, `trivia-${track.id}`).earned).toBe(true)
    const restored = parseBackup(serializeBackup(mocked))
    expect(restored.placements).toEqual(mocked.placements)
    expect(() => recordPlacement(fresh, track.id, 50, ['arrays-prefix-foundations'])).toThrow()
    const tampered = JSON.parse(serializeBackup(placed))
    tampered.placements[track.id].known = ['arrays-prefix-foundations']
    expect(() => parseBackup(JSON.stringify(tampered))).toThrow()
  })

  it('placement checks never apply to interview tracks', () => {
    const fresh = emptyProgress()
    expect(() => recordPlacement(fresh, 'dsa', 50, [])).toThrow()
    const tampered = JSON.parse(serializeBackup(fresh))
    tampered.placements = { dsa: { percent: 50, at: fresh.updatedAt, known: [] } }
    expect(() => parseBackup(JSON.stringify(tampered))).toThrow()
  })
})
