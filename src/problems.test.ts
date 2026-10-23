import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/problem-ids.json' with { type: 'json' }
import { validateProblem } from './content-schema'
import { lessons } from './curriculum'
import { loadProblems, problemIndex } from './problems'
import { patternIndex } from './patterns'
import { PROBLEM_PATTERNS, type Problem } from './problem-types'
import { deepEqual, formatArgs, formatValue, PY_HARNESS, pythonMessage, runJs, runPython } from './runner/core'
import { PYODIDE_VERSION } from './runner/pyodide-version'

const dir = 'content/problems'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json')
const problems = files.map(name => read(join(dir, name)) as Problem)
const casesOf = (problem: Problem) => [...problem.tests, ...problem.hiddenTests]

describe('problem content', () => {
  it('index.json lists exactly the problem files, in a stable order', () => {
    const { problems: order } = read(join(dir, 'index.json')) as { problems: string[] }
    expect([...order].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
    expect(problemIndex.map(problem => problem.id)).toEqual(order)
  })

  it.each(files)('%s is valid and its id matches the file', name => {
    const problem = read(join(dir, name)) as Problem
    expect(validateProblem(problem, name)).toEqual([])
    expect(problem.id).toBe(name.replace(/\.json$/, ''))
  })

  it('links only to lessons that exist', () => {
    const ids = new Set(lessons.map(lesson => lesson.id))
    expect(problems.filter(problem => problem.lessonId && !ids.has(problem.lessonId)).map(problem => problem.id)).toEqual([])
  })

  it('gives every problem a known pattern, and any sub-pattern names a published pattern page under it', () => {
    const categories = new Set<string>(PROBLEM_PATTERNS)
    expect(problems.filter(problem => !categories.has(problem.pattern)).map(problem => problem.id)).toEqual([])
    for (const problem of problems.filter(item => item.subpattern !== undefined)) {
      const page = patternIndex.find(item => item.id === problem.subpattern)
      expect(page, `${problem.id} subpattern`).toBeDefined()
      expect(page!.category, problem.id).toBe(problem.pattern)
    }
  })

  it('covers every core DSA pattern at both levels', () => {
    expect(new Set(problems.map(problem => problem.pattern)).size).toBeGreaterThanOrEqual(15)
    expect(problems.some(problem => problem.level === 'sse')).toBe(true)
  })

  it('gives every pattern Easy, Medium and Hard problems', () => {
    for (const pattern of PROBLEM_PATTERNS) {
      const tiers = new Set(problems.filter(problem => problem.pattern === pattern).map(problem => problem.difficulty))
      expect([...tiers].sort(), pattern).toEqual(['core', 'stretch', 'warm-up'])
    }
  })

  it('marks path-core problems so the SE path only needs SE-level problems', () => {
    for (const problem of problemIndex.filter(item => item.paths?.includes('swe'))) expect(problem.level, problem.id).toBe('se')
    expect(problemIndex.filter(item => item.paths?.includes('swe')).length).toBeGreaterThan(10)
    expect(problemIndex.filter(item => item.paths?.includes('senior')).length).toBeGreaterThan(10)
  })

  it('lazy-loads the same problems the index lists', async () => {
    const loaded = await loadProblems()
    expect([...loaded.keys()]).toEqual(problemIndex.map(problem => problem.id))
  })

  it('rejects malformed problems with readable errors', () => {
    expect(validateProblem({ id: 'Bad', level: 'staff', tests: [] })).toEqual(expect.arrayContaining([
      'problem.id: expected kebab-case id',
      'problem.level: expected se or sse',
      'problem.tests: expected at least 2 tests',
      'problem: missing "solution"',
    ]))
  })
})

// Problem IDs are stored in backups (the "solved" map). Append-only, like lesson IDs.
describe('problem id registry', () => {
  const current = new Set(problems.map(problem => problem.id))
  it('keeps every problem id that has ever shipped', () => expect(knownIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current problem id', () => expect([...current].filter(id => !knownIds.includes(id))).toEqual([]))
})

describe('runner core', () => {
  it('compares JSON values structurally', () => {
    expect(deepEqual({ a: [1, { b: null }] }, { a: [1, { b: null }] })).toBe(true)
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
  })

  it('formats values as JavaScript or Python literals', () => {
    expect(formatValue([true, null, 'x'], 'js')).toBe('[true,null,"x"]')
    expect(formatValue([true, null, 'x'], 'py')).toBe('[True, None, "x"]')
    expect(formatArgs([[1], 2], 'py')).toBe('[1], 2')
    expect(formatValue('x'.repeat(600), 'js')).toMatch(/more characters\)$/)
  })

  it('reports syntax errors, missing functions, thrown errors and console output', () => {
    expect(runJs({ code: 'function f( {', name: 'f', cases: [] })).toMatchObject({ kind: 'error', error: expect.stringMatching(/SyntaxError/) })
    expect(runJs({ code: 'const g = 1', name: 'f', cases: [] })).toMatchObject({ kind: 'error', error: 'Define a function named f.' })
    const result = runJs({ code: 'function f(x) { console.log("saw", x); if (x) throw new RangeError("boom"); return [x] }', name: 'f', cases: [{ args: [0], expected: [0] }, { args: [1], expected: [1] }] })
    expect(result).toMatchObject({ kind: 'done', output: 'saw 0\nsaw 1' })
    if (result.kind !== 'done') throw new Error('expected done')
    expect(result.outcomes.map(outcome => outcome.pass)).toEqual([true, false])
    expect(result.outcomes[1].error).toBe('RangeError: boom')
  })

  it('does not let a solution mutate the stored test arguments', () => {
    const cases = [{ args: [[3, 1, 2]], expected: [1, 2, 3] }]
    runJs({ code: 'function f(a) { return a.sort() }', name: 'f', cases })
    expect(cases[0].args).toEqual([[3, 1, 2]])
  })

  it('pins the bundled Pyodide version to the installed package', () => {
    expect((read('node_modules/pyodide/package.json') as { version: string }).version).toBe(PYODIDE_VERSION)
  })
})

describe.each(problems.map(problem => [problem.id, problem] as const))('%s', (_id, problem) => {
  it('JavaScript solution passes every visible and hidden test', () => {
    const result = runJs({ code: problem.solution.js, name: problem.function.js, cases: casesOf(problem) })
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass)).toEqual([])
  })

  it('JavaScript starter defines the function and fails the tests', () => {
    const result = runJs({ code: problem.starter.js, name: problem.function.js, cases: problem.tests })
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(result.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})

describe('Python solutions (Pyodide)', () => {
  let py: PyodideAPI
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    py.runPython(PY_HARNESS)
  }, 120_000)

  it.each(problems.map(problem => [problem.id, problem] as const))('%s passes every test; its starter fails', (_id, problem) => {
    const result = runPython(py, { code: problem.solution.py, name: problem.function.py, cases: casesOf(problem) })
    expect(result).toMatchObject({ kind: 'done' })
    if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass)).toEqual([])
    const starter = runPython(py, { code: problem.starter.py, name: problem.function.py, cases: problem.tests })
    expect(starter.kind).toBe('done')
    if (starter.kind === 'done') expect(starter.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })

  it('reports Python errors against the solution file only', () => {
    const result = runPython(py, { code: 'def f(x):\n    return 1 // x\n', name: 'f', cases: [{ args: [0], expected: 0 }] })
    if (result.kind !== 'done') throw new Error('expected done')
    expect(result.outcomes[0].error).toMatch(/solution\.py", line 2[\s\S]*ZeroDivisionError/)
    expect(result.outcomes[0].error).not.toMatch(/_devprep_/)
    expect(runPython(py, { code: 'def f(:\n', name: 'f', cases: [] })).toMatchObject({ kind: 'error', error: expect.stringMatching(/SyntaxError/) })
    expect(runPython(py, { code: 'x = 1\n', name: 'f', cases: [] })).toMatchObject({ kind: 'error', error: expect.stringMatching(/Define a function named f/) })
    expect(pythonMessage(new Error('Traceback\nValueError: x'))).toBe('ValueError: x')
  })
})
