import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { isLanguageTrack, lessons, loadLabs, tracks, type LessonLab } from './curriculum'
import { gameStats } from './gamification'
import { buildMock, MOCK_MINUTES, TRIVIA_ROUNDS } from './mocks'
import { placementResult } from './placement'
import { lessonQueue } from './planner'
import { emptyProgress, parseBackup, recordMock, recordPlacement, serializeBackup, updateProfile, type Progress } from './progress'
import { problemIndex } from './problems'
import { PY_HARNESS, runJsAsync, runPython } from './runner/core'
import { checkWithTypeChecks, createTsCompiler, formatDiagnostic, libClosure } from './runner/ts-core'
import { TYPESCRIPT_VERSION } from './runner/ts-version'

const labs = await loadLabs()
const labLessons = lessons.filter(lesson => isLanguageTrack(lesson.track))
const pyLabs = labLessons.filter(lesson => labs.get(lesson.id)?.lang === 'py').map(lesson => [lesson.id, labs.get(lesson.id)!] as const)
const tsLabs = labLessons.filter(lesson => labs.get(lesson.id)?.lang === 'ts').map(lesson => [lesson.id, labs.get(lesson.id)!] as const)
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
    for (const exercise of lab.exercises) {
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
    for (const exercise of lab.exercises) {
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
