import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { STARTERS } from '../playground'
import { SAMPLE_SQL } from '../playground-sample'
import {
  blockNetwork, describeJs, describeValue, PY_FREE_HARNESS, pythonFreeError, runJsFree, runPythonFree, runTypeScriptFree, sourceLineMap, stdinLines,
} from './free'
import { createTsCompiler, libClosure } from './ts-core'
import { resetFreeDb, runFreeSql, SQL_ROW_LIMIT, startFreeSession, type SqlDb } from './sql-core'

const js = (code: string, stdin = '') => runJsFree({ code, stdin })

describe('JavaScript free runs', () => {
  it('captures console output, the returned value and timing', async () => {
    const result = await js('console.log("hi", 1 + 1, [1, "a"], { a: 1 })\nconsole.warn("careful")\nreturn { ok: true }')
    expect(result).toMatchObject({ kind: 'done', output: 'hi 2 [1, "a"] { a: 1 }\nWarning: careful', value: '{ ok: true }' })
    expect(result.ms).toBeGreaterThanOrEqual(0)
    expect((await js('return "1"')).value).toBe('"1"')
    expect(await js('const x = 1')).not.toHaveProperty('value')
  })

  it('runs the JavaScript starter with stdin', async () => {
    expect(await js(STARTERS.js, 'Ada\n')).toMatchObject({ kind: 'done', output: 'Hello, Ada!', value: '[1, 4, 9, 16]' })
    expect(await js(STARTERS.js, '')).toMatchObject({ kind: 'done', output: 'Hello, world!' })
  })

  it('reads stdin line by line with readline() and input(), and exposes it whole', async () => {
    const result = await js('const a = readline(); const b = input("Next? "); console.log(a, b, readline(), JSON.stringify(stdin))', 'one\r\ntwo\n')
    expect(result.output).toBe('Next? \none two null "one\\r\\ntwo\\n"')
    expect(stdinLines('a\nb\n')).toEqual(['a', 'b'])
    expect(stdinLines('a\n\nb')).toEqual(['a', '', 'b'])
    expect(stdinLines('')).toEqual([])
  })

  it('lets programs shadow the helpers and use top-level await and timers', async () => {
    expect(await js('const input = 5; let stdin = 2; return input * stdin')).toMatchObject({ kind: 'done', value: '10' })
    const timers = await js('setTimeout(() => console.log("later"), 20)\nconsole.log("now")\nawait new Promise(done => setTimeout(done, 5))\nconsole.log("awaited")')
    expect(timers).toMatchObject({ kind: 'done', output: 'now\nawaited\nlater' })
    const interval = await js('let n = 0; const id = setInterval(() => { n++; console.log(n); if (n === 3) clearInterval(id) }, 1)')
    expect(interval.output).toBe('1\n2\n3')
  })

  it('reports uncaught errors with the line in the learner\'s code', async () => {
    const result = await js('console.log("before")\nconst x = 1\nnull.boom()\nconsole.log("after")')
    expect(result).toMatchObject({ kind: 'error', output: 'before', line: 3 })
    expect(result.error).toMatch(/^TypeError: /)
    const async = await js('await Promise.resolve()\n\nthrow new RangeError("nope")')
    expect(async).toMatchObject({ kind: 'error', error: 'RangeError: nope', line: 3 })
    expect(await js('setTimeout(() => { throw new Error("in timer") }, 1)')).toMatchObject({ kind: 'error', error: 'Error: in timer' })
    expect((await js('throw 42')).error).toBe('Uncaught 42')
  })

  it('reports syntax errors, using the line finder when given one', async () => {
    const plain = await js('let = ;')
    expect(plain).toMatchObject({ kind: 'error' })
    expect(plain.error).toMatch(/^SyntaxError/)
    const found = await runJsFree({ code: 'ok()\nlet = ;', stdin: '' }, { syntaxLine: async () => 2 })
    expect(found).toMatchObject({ kind: 'error', line: 2 })
  })

  it('refuses imports, since there is no network or module loader', async () => {
    for (const code of ['import x from "y"', 'const m = await import("https://example.com/m.js")']) {
      const result = await js(code)
      expect(result.kind).toBe('error')
      expect(result.error).toContain('Imports are not available')
    }
  })

  it('caps output and describes values safely', async () => {
    const result = await js('for (let i = 0; i < 50000; i++) console.log("line", i)')
    expect(result.output.length).toBeLessThan(21_000)
    const circular: Record<string, unknown> = { name: 'loop' }
    circular.self = circular
    expect(describeJs(circular)).toBe('{ name: "loop", self: [Circular] }')
    expect(describeJs(new Map([[1, 'a']]))).toBe('Map(1) {1 => "a"}')
    expect(describeJs(new Set([1]))).toBe('Set(1) {1}')
    expect(describeJs(10n)).toBe('10n')
    expect(describeJs(() => 1)).toBe('[Function (anonymous)]')
    expect(describeValue('x'.repeat(5000)).length).toBeLessThan(2100)
  })

  it('blocks network APIs on a worker-like scope and its prototype', () => {
    class Base { fetch() { return 'real' } }
    const scope = Object.assign(Object.create(Base.prototype) as Record<string, unknown>, { XMLHttpRequest: class {}, WebSocket: class {} })
    blockNetwork(scope)
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'EventSource']) {
      expect(() => (scope[name] as () => void)(), name).toThrow('Network access is turned off in the Playground.')
    }
    expect(() => (Base.prototype.fetch as () => void)()).toThrow('Network access is turned off')
    expect(() => { scope.fetch = () => 'sneaky' }).toThrow(TypeError)
    expect(() => (scope.fetch as () => void)()).toThrow('Network access')
  })
})

describe('source line maps', () => {
  it('maps generated lines back to source lines', () => {
    // Generated line 1 ← source line 1; line 2 ← source line 3; line 3 has no mapping; line 4 ← source line 2.
    const map = sourceLineMap('AAAA;AAEA;;AAChB')
    expect([1, 2, 3, 4].map(map)).toEqual([1, 3, 3, 4])
    expect(sourceLineMap('')(1)).toBeUndefined()
  })
})

describe('TypeScript free runs (compiler)', () => {
  const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
  const compiler = createTsCompiler(ts, Object.fromEntries(libClosure(read).map(name => [name, read(name)])))

  it('runs the TypeScript starter', async () => {
    expect(await runTypeScriptFree(compiler, { code: STARTERS.ts, stdin: '' })).toMatchObject({ kind: 'done', output: '5', value: '5' })
  })

  it('lists type errors on the learner\'s lines and still runs the code', async () => {
    const result = await runTypeScriptFree(compiler, { code: 'const n: number = "x"\nconsole.log(n)\nconst s: string | null = readline()', stdin: 'a\n' })
    expect(result).toMatchObject({ kind: 'done', output: 'x' })
    expect(result.diagnostics?.map(diagnostic => [diagnostic.line, diagnostic.code])).toEqual([[1, 2322]])
  })

  it('maps runtime errors back to the TypeScript line', async () => {
    const code = 'interface P { x: number }\n\nconst points: P[] = []\n\nconsole.log("start")\nconst first = points[0] as P\nconsole.log(first.x)'
    expect(await runTypeScriptFree(compiler, { code, stdin: '' })).toMatchObject({ kind: 'error', output: 'start', line: 7 })
  })
})

describe('Python free runs (Pyodide)', () => {
  let py: PyodideAPI
  let output = ''
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    py.runPython(PY_FREE_HARNESS)
    py.setStdout({ batched: text => { output += `${text}\n` } })
    py.setStderr({ batched: text => { output += `${text}\n` } })
  }, 120_000)
  const flush = () => { const text = output.replace(/\n$/, ''); output = ''; return text }
  const run = (code: string, stdin = '') => runPythonFree(py, { code, stdin }, flush)

  it('runs the Python starter, feeding input() from stdin and showing the last value', () => {
    expect(run(STARTERS.py, 'Ada\n')).toMatchObject({ kind: 'done', output: 'Name? Hello, Ada!', value: "[('i', 4), ('s', 4)]" })
  })

  it('raises EOFError when stdin runs out, with the line', () => {
    const result = run('a = input()\nb = input()', 'only\n')
    expect(result).toMatchObject({ kind: 'error', line: 2 })
    expect(result.error).toContain('EOFError')
    expect(result.error).not.toContain('_devprep_')
  })

  it('reports errors with the line in main.py and keeps output so far', () => {
    const result = run('print("before")\n\ndef f():\n    return 1 / 0\n\nf()')
    expect(result).toMatchObject({ kind: 'error', output: 'before', line: 4 })
    expect(result.error).toContain('ZeroDivisionError')
    const syntax = run('x = (1,\nprint(x)')
    expect(syntax.kind).toBe('error')
    expect(syntax.error).toContain('SyntaxError')
  })

  it('gives each run a fresh namespace, and no value for None or statements', () => {
    expect(run('x = 5')).not.toHaveProperty('value')
    expect(run('x')).toMatchObject({ kind: 'error' })
    expect(run('print("hi")')).toMatchObject({ kind: 'done', output: 'hi' })
    expect(run('import sys\nsys.stdin.readline()', 'whole\n')).toMatchObject({ value: "'whole\\n'" })
  })

  it('extracts the learner\'s frames from a traceback', () => {
    const traceback = 'Traceback (most recent call last):\n  File "/lib/python.zip/_pyodide/_base.py", line 1, in eval_code\n  File "<exec>", line 20, in _devprep_free\n  File "main.py", line 3, in <module>\nNameError: name \'y\' is not defined'
    expect(pythonFreeError(new Error(traceback))).toEqual({ error: 'Traceback (most recent call last):\n  File "main.py", line 3, in <module>\nNameError: name \'y\' is not defined', line: 3 })
  })
})

describe('SQL free runs (PGlite)', () => {
  let db: SqlDb
  beforeAll(async () => {
    db = await PGlite.create() as unknown as SqlDb
    await startFreeSession(db)
  }, 60_000)
  afterAll(async () => { await (db as unknown as PGlite).close() })

  it('loads the sample data and runs the SQL starter', async () => {
    const sample = await runFreeSql(db, SAMPLE_SQL)
    expect(sample.kind).toBe('done')
    if (sample.kind !== 'done') return
    expect(sample.results.at(-1)?.rows).toEqual([['customers', 5], ['products', 6], ['orders', 6], ['order_items', 10]])
    const starter = await runFreeSql(db, STARTERS.sql)
    expect(starter).toMatchObject({ kind: 'done', results: [{ columns: ['name', 'orders', 'spent'], rowCount: 5 }] })
    if (starter.kind === 'done') expect(starter.results[0].rows![0]).toEqual(['Dev Patel', 1, 49])
    expect((await runFreeSql(db, SAMPLE_SQL)).kind).toBe('done')
  })

  it('returns one result per statement, with row counts for changes', async () => {
    const result = await runFreeSql(db, 'CREATE TABLE notes (id int, body text);\nINSERT INTO notes VALUES (1, \'a\'), (2, \'b\');\nUPDATE notes SET body = \'c\' WHERE id = 2;\nSELECT * FROM notes ORDER BY id;')
    expect(result.kind).toBe('done')
    if (result.kind !== 'done') return
    expect(result.results).toHaveLength(4)
    expect(result.results[1]).toMatchObject({ rowCount: 2 })
    expect(result.results[2]).toMatchObject({ rowCount: 1 })
    expect(result.results[3]).toMatchObject({ columns: ['id', 'body'], rows: [[1, 'a'], [2, 'c']], rowCount: 2 })
  })

  it('rolls a failing batch back as one transaction, and recovers after an open BEGIN', async () => {
    const failed = await runFreeSql(db, 'INSERT INTO notes VALUES (3, \'x\');\nSELECT * FROM missing_table;')
    expect(failed.kind).toBe('error')
    if (failed.kind === 'error') expect(failed.error).toContain('missing_table')
    const count = await runFreeSql(db, 'SELECT count(*) AS n FROM notes')
    expect(count).toMatchObject({ kind: 'done', results: [{ rows: [[2]] }] })
    await runFreeSql(db, 'BEGIN; SELECT 1/0;')
    expect(await runFreeSql(db, 'SELECT 1 AS one')).toMatchObject({ kind: 'done', results: [{ rows: [[1]] }] })
    expect(await runFreeSql(db, '   ')).toMatchObject({ kind: 'error', error: 'Write some SQL first.' })
  })

  it(`caps result sets at ${SQL_ROW_LIMIT} rows`, async () => {
    const result = await runFreeSql(db, 'SELECT n FROM generate_series(1, 500) AS n')
    expect(result).toMatchObject({ kind: 'done', results: [{ rowCount: 500, truncated: true }] })
    if (result.kind === 'done') expect(result.results[0].rows).toHaveLength(SQL_ROW_LIMIT)
  })

  it('resets the database to empty', async () => {
    await resetFreeDb(db)
    const result = await runFreeSql(db, 'SELECT * FROM notes')
    expect(result.kind).toBe('error')
    expect(await runFreeSql(db, 'SELECT current_setting(\'TimeZone\') AS tz')).toMatchObject({ kind: 'done', results: [{ rows: [['UTC']] }] })
  })
})
