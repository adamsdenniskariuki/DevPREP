import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import RunProgress, { runStep } from '../components/RunProgress'
import { isProgressMessage, runJs, runJsAsync, runPython, type PythonRuntime, type RunRequest } from './core'
import { RUN_TIMEOUT_MS, TS_TIMEOUT_MS, withProgress } from './runner'
import { resetDb, runSql, type SqlDb } from './sql-core'

const request: RunRequest = {
  code: 'function half(n) { if (n < 0) throw new Error("negative"); return n / 2 }',
  name: 'half',
  cases: [{ args: [4], expected: 2 }, { args: [-1], expected: 0 }, { args: [3], expected: 1.5 }],
}

describe('per-case progress in the runner', () => {
  it('recognises progress messages and only those', () => {
    expect(isProgressMessage({ type: 'progress', done: 2 })).toBe(true)
    expect(isProgressMessage({ type: 'progress' })).toBe(false)
    expect(isProgressMessage({ type: 'result', result: {} })).toBe(false)
    expect(isProgressMessage({ kind: 'done', outcomes: [], output: '' })).toBe(false)
    expect(isProgressMessage(null)).toBe(false)
  })

  it('sends progress to the callback and keeps waiting, then accepts the result', () => {
    const seen: number[] = []
    const accept = withProgress(data => (data as { type: string }).type === 'result' ? 'result' : undefined, done => seen.push(done))
    expect(accept({ type: 'progress', done: 1 })).toBeUndefined()
    expect(accept({ type: 'progress', done: 2 })).toBeUndefined()
    expect(accept({ type: 'ready' })).toBeUndefined()
    expect(accept({ type: 'result' })).toBe('result')
    expect(seen).toEqual([1, 2])
  })

  it('counts every JavaScript case, including ones that throw, without changing the results', () => {
    const seen: number[] = []
    const withCallback = runJs(request, done => seen.push(done))
    expect(seen).toEqual([1, 2, 3])
    const plain = runJs(request)
    const strip = (response: typeof plain) => response.kind === 'done' ? response.outcomes.map(({ pass, actual, error }) => ({ pass, actual, error })) : response
    expect(strip(withCallback)).toEqual(strip(plain))
    expect(withCallback).toMatchObject({ kind: 'done', outcomes: [{ pass: true }, { pass: false, error: 'Error: negative' }, { pass: true }] })
  })

  it('reports nothing when the code does not define the function', () => {
    const seen: number[] = []
    expect(runJs({ ...request, name: 'missing' }, done => seen.push(done)).kind).toBe('error')
    expect(seen).toEqual([])
  })

  it('counts async (TypeScript) cases as they settle', async () => {
    const seen: number[] = []
    const code = 'async function later(n) { await null; return n * 2 }'
    const result = await runJsAsync({ code, name: 'later', cases: [{ args: [1], expected: 2 }, { args: [2], expected: 5 }] }, 3000, done => seen.push(done))
    expect(seen).toEqual([1, 2])
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: true }, { pass: false }] })
  })

  it('counts Python cases from the JavaScript loop that calls the harness', () => {
    const fn = Object.assign((n: number) => n, { destroy: () => {} })
    const functions: Record<string, unknown> = {
      _devprep_define: () => fn,
      _devprep_call: (_fn: unknown, args: string) => {
        const [n] = JSON.parse(args) as number[]
        if (n < 0) throw new Error('ValueError: negative')
        return JSON.stringify(n / 2)
      },
    }
    const py: PythonRuntime = { globals: { get: (name: string) => functions[name] } }
    const seen: number[] = []
    const result = runPython(py, request, () => '', done => seen.push(done))
    expect(seen).toEqual([1, 2, 3])
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: true }, { pass: false }, { pass: true }] })
  })

  it('counts SQL cases', async () => {
    const db = await PGlite.create() as unknown as SqlDb
    await resetDb(db)
    const expected = { columns: ['n'], rows: [[1]] }
    const cases = [{ name: 'a', seed: '', expected }, { name: 'b', seed: '', expected }]
    const seen: number[] = []
    const result = await runSql(db, { code: 'SELECT 1 AS n', schema: '', cases }, done => seen.push(done))
    expect(seen).toEqual([1, 2])
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: true }, { pass: true }] })
  }, 120_000)

  it('uses the runner time limits for the indicator', () => {
    expect(RUN_TIMEOUT_MS).toEqual({ js: 5000, py: 10000, ts: TS_TIMEOUT_MS })
  })
})

describe('RunProgress', () => {
  const render = (props: Parameters<typeof RunProgress>[0]) => renderToStaticMarkup(createElement(RunProgress, props))

  it('renders only an empty live region when idle', () => {
    const html = render({ phase: 'idle', total: 3, limitMs: 5000 })
    expect(html).not.toContain('progressbar')
    expect(html).toContain('aria-live="polite"')
  })

  it('is determinate while tests run, with test-by-test values and the time limit', () => {
    const html = render({ phase: 'running', total: 8, done: 2, limitMs: 10000 })
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-label="Test run progress"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="8"')
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('aria-valuetext="2 of 8 tests done"')
    expect(html).toContain('Running 8 tests…')
    expect(html).toContain('Test 3 of 8')
    expect(html).toContain('stops after 10 s')
    expect(html).toContain('width:25%')
  })

  it('never reports more tests done than there are', () => {
    const html = render({ phase: 'running', total: 2, done: 5, limitMs: 5000 })
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('Test 2 of 2')
  })

  it('is indeterminate while loading, with no value and no time limit', () => {
    const html = render({ phase: 'loading-python', total: 8, limitMs: 10000 })
    expect(html).toContain('role="progressbar"')
    expect(html).not.toContain('aria-valuenow')
    expect(html).toContain('indeterminate')
    expect(html).toContain('Loading Python (first run downloads it; cached after)…')
    expect(html).not.toContain('stops after')
  })

  it('is indeterminate for a run with no tests', () => {
    const html = render({ phase: 'running', limitMs: 5000, name: 'Run progress' })
    expect(html).not.toContain('aria-valuenow')
    expect(html).toContain('aria-label="Run progress"')
    expect(html).toContain('Running your code…')
    expect(html).toContain('stops after 5 s')
  })

  it('names every step', () => {
    expect(runStep('loading-numpy')).toMatch(/^Loading Python and NumPy/)
    expect(runStep('loading-typescript')).toMatch(/^Loading TypeScript/)
    expect(runStep('loading-sql')).toMatch(/^Loading SQL/)
    expect(runStep('running', 1)).toBe('Running 1 test…')
  })
})
