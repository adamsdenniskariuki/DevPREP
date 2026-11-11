import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createProjectChecker, normalisePath, PROJECT_TIMEOUT_MS, PY_PROJECT_HARNESS, resolveImport, runPythonProject, runTypeScriptProject, type ProjectRunRequest,
} from './project'
import { libClosure, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS } from './ts-core'

const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
const libs = Object.fromEntries(libClosure(read).map(name => [name, read(name)]))
const check = createProjectChecker(ts, libs, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS)
const runTs = (request: ProjectRunRequest, onCase?: (done: number) => void) => runTypeScriptProject(ts, check, request, onCase)

describe('TypeScript projects', () => {
  const files = {
    'src/money.ts': 'export const cents = (amount: number): number => Math.round(amount * 100)\n',
    'src/cart.ts': 'import { cents } from "./money"\nexport class Cart { items: number[] = []; add(price: number) { this.items.push(cents(price)); return this } total() { return this.items.reduce((a, b) => a + b, 0) } }\n',
    'src/index.ts': 'export { Cart } from "./cart"\n',
    'tests/cart.test.ts': [
      'import { Cart } from "../src"',
      'export function testAdds() { assertEqual(new Cart().add(1.5).add(2).total(), 350) }',
      'export function testFails() { assertEqual(new Cart().total(), 1, "empty cart") }',
      'export async function testAsync() { await Promise.resolve(); assert(true) }',
    ].join('\n'),
  }

  it('resolves relative imports across files, including folder index files, and runs tests in source order', async () => {
    const seen: number[] = []
    const result = await runTs({ files, tests: ['tests/cart.test.ts'] }, done => seen.push(done))
    expect(result.kind).toBe('done')
    if (result.kind !== 'done') return
    expect(result.diagnostics).toBeUndefined()
    expect(result.outcomes.map(({ name, pass }) => [name, pass])).toEqual([
      ['tests/cart.test.ts::testAdds', true], ['tests/cart.test.ts::testFails', false], ['tests/cart.test.ts::testAsync', true],
    ])
    expect(result.outcomes[1].error).toBe('AssertionError: empty cart: expected 1, got 0')
    expect(seen).toEqual([1, 2, 3])
  })

  it('starts every run with fresh modules, so edits and module state never carry over', async () => {
    const counter = { 'count.ts': 'let n = 0\nexport const next = () => ++n\n', 'count.test.ts': 'import { next } from "./count"\nexport function testFirst() { assertEqual(next(), 1) }\n' }
    expect(await runTs({ files: counter, tests: ['count.test.ts'] })).toMatchObject({ outcomes: [{ pass: true }] })
    expect(await runTs({ files: counter, tests: ['count.test.ts'] })).toMatchObject({ outcomes: [{ pass: true }] })
    const edited = await runTs({ files: { ...counter, 'count.ts': 'let n = 10\nexport const next = () => ++n\n' }, tests: ['count.test.ts'] })
    expect(edited).toMatchObject({ outcomes: [{ pass: false, error: 'AssertionError: expected 1, got 11' }] })
  })

  it('reports type errors with their file but still runs the tests', async () => {
    const result = await runTs({ files: { ...files, 'src/money.ts': 'export const cents = (amount: number): string => Math.round(amount * 100)\n' }, tests: ['tests/cart.test.ts'] })
    expect(result.kind).toBe('done')
    expect(result.diagnostics?.[0]).toMatchObject({ file: 'src/money.ts', line: 1, code: 2322 })
  })

  it('stops on syntax errors and names the file and line', async () => {
    const result = await runTs({ files: { ...files, 'src/cart.ts': 'export class Cart {\n  add( {\n' }, tests: ['tests/cart.test.ts'] })
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.error).toMatch(/src\/cart\.ts line \d+/)
    expect(result.diagnostics?.some(item => item.file === 'src/cart.ts' && item.code! < 2000)).toBe(true)
  })

  it('only resolves relative imports inside the project', async () => {
    expect(resolveImport('a/b.ts', '../c', path => path === 'c.ts')).toBe('c.ts')
    expect(resolveImport('a/b.ts', './d', path => path === 'a/d/index.ts')).toBe('a/d/index.ts')
    expect(resolveImport('b.ts', 'fs', () => true)).toBeUndefined()
    expect(resolveImport('b.ts', '../../etc', () => true)).toBeUndefined()
    expect(normalisePath('a/./b/../c')).toBe('a/c')
    const result = await runTs({ files: { 't.test.ts': '// @ts-ignore\nimport { readFileSync } from "fs"\nexport function testX() { readFileSync }\n' }, tests: ['t.test.ts'] })
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: false, error: expect.stringContaining('Only relative imports') }] })
  })

  it('offers assertThrows and reports a test file that fails to load', async () => {
    const result = await runTs({
      files: { 'a.test.ts': 'export function testThrows() { assertThrows(() => { throw new Error("boom") }, "boom") }\nexport function testNoThrow() { assertThrows(() => 1) }\n', 'b.test.ts': 'throw new Error("bad setup")\nexport function testNever() {}\n' },
      tests: ['a.test.ts', 'b.test.ts', 'missing.test.ts'],
    })
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: true }, { pass: false, error: expect.stringContaining('expected the call to throw') }, { name: 'b.test.ts::(import)', pass: false, error: expect.stringContaining('bad setup') }] })
  })
})

describe('Python projects', () => {
  let py: PyodideAPI
  let output = ''
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/`, stdout: line => { output += `${line}\n` }, stderr: line => { output += `${line}\n` } })
    py.runPython(PY_PROJECT_HARNESS)
  }, 120_000)
  const flush = () => { const text = output.trimEnd(); output = ''; return text }
  const run = (request: ProjectRunRequest, onCase?: (done: number) => void) => runPythonProject(py, request, flush, onCase)

  const files = {
    'shop/__init__.py': '',
    'shop/money.py': 'def cents(amount):\n    return round(amount * 100)\n',
    'shop/cart.py': 'from shop.money import cents\n\nclass Cart:\n    def __init__(self):\n        self.items = []\n\n    def add(self, price):\n        self.items.append(cents(price))\n        return self\n\n    def total(self):\n        return sum(self.items)\n',
    'tests/test_cart.py': 'from shop.cart import Cart\n\ndef test_adds():\n    print("checking")\n    assert Cart().add(1.5).add(2).total() == 350\n\ndef test_empty():\n    assert Cart().total() == 1, "empty cart"\n\ndef helper():\n    pass\n',
  }

  it('imports across files and packages and runs test_ functions in source order', () => {
    const seen: number[] = []
    const result = run({ files, tests: ['tests/test_cart.py'] }, done => seen.push(done))
    expect(result.kind).toBe('done')
    if (result.kind !== 'done') return
    expect(result.outcomes.map(({ name, pass }) => [name, pass])).toEqual([['tests/test_cart.py::test_adds', true], ['tests/test_cart.py::test_empty', false]])
    expect(result.outcomes[1].error).toContain('AssertionError: empty cart')
    expect(result.outcomes[1].error).toContain('tests/test_cart.py line 8: assert Cart().total() == 1, "empty cart"')
    expect(result.output).toBe('checking')
    expect(seen).toEqual([1, 2])
  })

  it('reloads every module between runs, so edits always take effect', () => {
    expect(run({ files, tests: ['tests/test_cart.py'] })).toMatchObject({ outcomes: [{ pass: true }, { pass: false }] })
    const edited = run({ files: { ...files, 'shop/money.py': 'def cents(amount):\n    return round(amount * 1000)\n' }, tests: ['tests/test_cart.py'] })
    expect(edited).toMatchObject({ outcomes: [{ pass: false }, { pass: false }] })
    const removed = run({ files: { 'tests/test_cart.py': files['tests/test_cart.py'] }, tests: ['tests/test_cart.py'] })
    expect(removed).toMatchObject({ kind: 'done', outcomes: [{ name: 'tests/test_cart.py::(import)', pass: false, error: expect.stringContaining('ModuleNotFoundError') }] })
  })

  it('reports syntax errors per file before running anything', () => {
    const result = run({ files: { ...files, 'shop/money.py': 'def cents(amount)\n    return 1\n' }, tests: ['tests/test_cart.py'] })
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.diagnostics).toEqual([expect.objectContaining({ file: 'shop/money.py', line: 1 })])
    expect(result.error).toContain('shop/money.py line 1')
  })

  it('reports where a runtime error happened inside the project', () => {
    const result = run({ files: { ...files, 'shop/money.py': 'def cents(amount):\n    return amount / 0\n' }, tests: ['tests/test_cart.py'] })
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: false, error: expect.stringContaining('ZeroDivisionError') }, { pass: false, error: expect.stringContaining('empty cart') }] })
    if (result.kind === 'done') expect(result.outcomes[0].error).toContain('shop/money.py line 2')
  })
})

describe('runProject time limit', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules() })

  it('stops a runaway project run and reports the limit', async () => {
    vi.useFakeTimers()
    const terminated: string[] = []
    class FakeWorker {
      listeners = new Map<string, Set<(event: unknown) => void>>()
      readonly options: { name: string }
      constructor(_url: URL, options: { name: string }) { this.options = options }
      addEventListener(type: string, listener: (event: unknown) => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(listener) }
      removeEventListener(type: string, listener: (event: unknown) => void) { this.listeners.get(type)?.delete(listener) }
      postMessage(message: { type: string }) {
        // Ready to load, then never answers the project run, like an endless loop would.
        if (message.type === 'init') queueMicrotask(() => this.listeners.get('message')?.forEach(listener => listener({ data: { type: 'ready' } })))
      }
      terminate() { terminated.push(this.options.name) }
    }
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('document', { baseURI: 'http://localhost/' })
    const { runProject } = await import('./runner')
    const phases: string[] = []
    const pending = runProject('ts', { files: { 'a.test.ts': 'export function testLoop() { for (;;) {} }' }, tests: ['a.test.ts'] }, phase => phases.push(phase))
    await vi.advanceTimersByTimeAsync(PROJECT_TIMEOUT_MS.ts + 10)
    expect(await pending).toMatchObject({ kind: 'timeout', limitMs: PROJECT_TIMEOUT_MS.ts })
    expect(phases).toEqual(['loading-typescript', 'running'])
    expect(terminated).toEqual(['devprep-typescript'])
  })
})
