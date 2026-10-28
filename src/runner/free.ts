/**
 * Playground ("free run") support for the workers: run a whole program with no tests, capture its output,
 * the value it returns, and the first uncaught error with a line number.
 */
import { truncate, type TypeDiagnostic } from './core'
import type { createTsCompiler } from './ts-core'

export const FREE_OUTPUT_LIMIT = 20_000
export const VALUE_LIMIT = 2_000

export interface FreeRunRequest {
  code: string
  stdin: string
}

export interface FreeRunResult {
  kind: 'done' | 'error'
  /** stdout and stderr, in order. */
  output: string
  /** JavaScript: a top-level `return` value. Python: the last expression's value (when not None). */
  value?: string
  error?: string
  /** 1-based line in the learner's code where the error happened, when known. */
  line?: number
  /** TypeScript type errors (the code still runs). */
  diagnostics?: TypeDiagnostic[]
  ms: number
}

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now())

/** Splits stdin into lines; a trailing newline does not add an empty line. */
export function stdinLines(stdin: string): string[] {
  if (!stdin) return []
  const lines = stdin.replace(/\r\n?/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** A readable, bounded rendering of any JavaScript value, close to what browser consoles print. */
export function describeJs(value: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return depth === 0 ? value : JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || '(anonymous)'}]`
  if (typeof value !== 'object') return String(value)
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (seen.has(value)) return '[Circular]'
  if (depth > 4) return Array.isArray(value) ? '[Array]' : '[Object]'
  seen.add(value)
  try {
    const inner = (item: unknown) => describeJs(item, depth + 1, seen)
    if (Array.isArray(value)) return `[${value.slice(0, 100).map(inner).join(', ')}${value.length > 100 ? `, … ${value.length - 100} more` : ''}]`
    if (value instanceof Map) return `Map(${value.size}) {${[...value].slice(0, 50).map(([key, item]) => `${inner(key)} => ${inner(item)}`).join(', ')}}`
    if (value instanceof Set) return `Set(${value.size}) {${[...value].slice(0, 50).map(inner).join(', ')}}`
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
    if (value instanceof RegExp) return String(value)
    if (typeof (value as PromiseLike<unknown>).then === 'function') return 'Promise {…}'
    const entries = Object.entries(value).slice(0, 50).map(([key, item]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${inner(item)}`)
    const name = Object.getPrototypeOf(value)?.constructor?.name
    const prefix = name && name !== 'Object' ? `${name} ` : ''
    return entries.length ? `${prefix}{ ${entries.join(', ')} }` : `${prefix}{}`
  } finally {
    seen.delete(value)
  }
}

/** Shows top-level `return` values: strings quoted, so "1" and 1 look different. */
export function describeValue(value: unknown): string {
  return truncate(typeof value === 'string' ? JSON.stringify(value) : describeJs(value), VALUE_LIMIT)
}

const BLOCKED = 'Network access is turned off in the Playground.'
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel']

/**
 * Replaces network APIs in a worker with functions that throw, on the global and on its prototype chain, so
 * code cannot reach the original through the prototype. Best effort: the app is static and holds no secrets.
 */
export function blockNetwork(scope: object = globalThis) {
  const stub = function blocked() { throw new Error(BLOCKED) }
  for (let target: object | null = scope; target && target !== Object.prototype; target = Object.getPrototypeOf(target)) {
    for (const name of NETWORK_GLOBALS) {
      if (!Object.hasOwn(target, name) && target !== scope) continue
      try { Object.defineProperty(target, name, { value: stub, writable: false, configurable: false }) } catch { /* already locked */ }
    }
  }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>
const PARAMS = ['console', 'stdin', 'readline', 'input', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']
// The program runs in an inner async arrow so it may declare its own `input` or `stdin` and use top-level await and return.
const HEADER = '"use strict"; return (async () => {'
const FOOTER = '\n})()'
const FRAME = /(?:<anonymous>|> (?:Async)?Function):(\d+):(\d+)/

let lineOffset: number | undefined
/** How many lines the generated function adds before the learner's first line (engine-specific, so measured). */
function offset(): number {
  if (lineOffset === undefined) {
    lineOffset = 0
    try {
      // The body runs synchronously up to its first await, so the stack is captured right away.
      const probe = new AsyncFunction(...PARAMS, `${HEADER}\nconsole(new Error('probe').stack)${FOOTER}`)
      void probe((stack: unknown) => { const match = FRAME.exec(String(stack)); lineOffset = match ? Number(match[1]) - 1 : 0 })
    } catch { /* keep 0 */ }
  }
  return lineOffset
}

function errorLine(error: unknown, lineMap?: (line: number) => number | undefined): number | undefined {
  const stack = error instanceof Error ? error.stack : undefined
  const match = stack ? FRAME.exec(stack) : null
  if (!match) return undefined
  const line = Number(match[1]) - offset()
  if (line < 1) return undefined
  return lineMap ? lineMap(line) : line
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : `Uncaught ${describeJs(error)}`
}

export interface JsFreeOptions {
  /** Maps a line of the code that ran back to the learner's source (TypeScript). */
  lineMap?: (line: number) => number | undefined
  /** Finds the line of a syntax error the engine reported without a position. */
  syntaxLine?: (code: string) => Promise<number | undefined>
}

/**
 * Runs a JavaScript program as the body of an async function, so top-level await and `return` work.
 * Waits for pending timers so setTimeout output shows; the caller's time limit stops runaway intervals.
 */
export async function runJsFree({ code, stdin }: FreeRunRequest, options: JsFreeOptions = {}): Promise<FreeRunResult> {
  offset()
  const started = now()
  const output: string[] = []
  let size = 0
  const write = (prefix = '') => (...parts: unknown[]) => {
    if (size > FREE_OUTPUT_LIMIT) return
    const line = prefix + parts.map(part => describeJs(part)).join(' ')
    size += line.length + 1
    output.push(line)
  }
  const log = write()
  const fakeConsole = {
    log, info: log, debug: log, warn: write('Warning: '), error: write('Error: '), trace: log,
    table: (data: unknown) => log(data), dir: (data: unknown) => log(data),
  }
  const lines = stdinLines(stdin)
  const readline = () => lines.length ? lines.shift()! : null
  const input = (prompt?: unknown) => { if (prompt !== undefined && prompt !== '') log(prompt); return readline() }

  let failure: unknown
  let failed = false
  const fail = (error: unknown) => { if (!failed) { failed = true; failure = error } }
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const intervals = new Set<ReturnType<typeof setInterval>>()
  const guard = (fn: unknown, args: unknown[]) => () => {
    try { if (typeof fn === 'function') fn(...args) } catch (error) { fail(error) }
  }
  const fakeSetTimeout = (fn: unknown, ms?: number, ...args: unknown[]) => {
    const id = setTimeout(() => { timers.delete(id); guard(fn, args)() }, ms)
    timers.add(id)
    return id
  }
  const fakeClearTimeout = (id: ReturnType<typeof setTimeout>) => { timers.delete(id); clearTimeout(id) }
  const fakeSetInterval = (fn: unknown, ms?: number, ...args: unknown[]) => {
    const id = setInterval(guard(fn, args), ms)
    intervals.add(id)
    return id
  }
  const fakeClearInterval = (id: ReturnType<typeof setInterval>) => { intervals.delete(id); clearInterval(id) }
  const flush = () => truncate(output.join('\n'), FREE_OUTPUT_LIMIT)
  const finish = (result: Omit<FreeRunResult, 'output' | 'ms'>): FreeRunResult => {
    for (const id of timers) clearTimeout(id)
    for (const id of intervals) clearInterval(id)
    return { ...result, output: flush(), ms: Math.round(now() - started) }
  }

  if (/\bimport\s*\(/.test(code) || /^\s*import\s[\s\S]*?from\s/m.test(code)) {
    return finish({ kind: 'error', error: 'Imports are not available in the Playground: there is no network or module loader. Paste the code you need instead.' })
  }
  let program: (...args: unknown[]) => Promise<unknown>
  try {
    program = new AsyncFunction(...PARAMS, `${HEADER}\n${code}${FOOTER}`)
  } catch (error) {
    const line = options.syntaxLine ? await options.syntaxLine(code).catch(() => undefined) : undefined
    return finish({ kind: 'error', error: describeError(error), ...line ? { line } : {} })
  }
  let value: unknown
  try {
    value = await program(fakeConsole, stdin, readline, input, fakeSetTimeout, fakeSetInterval, fakeClearTimeout, fakeClearInterval)
  } catch (error) {
    fail(error)
  }
  while (!failed && (timers.size > 0 || intervals.size > 0)) await new Promise(resolve => setTimeout(resolve, 5))
  if (failed) {
    const line = errorLine(failure, options.lineMap)
    return finish({ kind: 'error', error: describeError(failure), ...line ? { line } : {} })
  }
  return finish({ kind: 'done', ...value !== undefined ? { value: describeValue(value) } : {} })
}

const VLQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Reads a source map's mappings into "generated line → source line" (both 1-based). */
export function sourceLineMap(mappings: string): (line: number) => number | undefined {
  const table: (number | undefined)[] = []
  let sourceLine = 0
  mappings.split(';').forEach((group, generated) => {
    for (const segment of group.split(',')) {
      if (!segment) continue
      const values: number[] = []
      let shift = 0
      let current = 0
      for (const char of segment) {
        const digit = VLQ.indexOf(char)
        current += (digit & 31) << shift
        if (digit & 32) { shift += 5; continue }
        values.push(current & 1 ? -(current >> 1) : current >> 1)
        current = 0
        shift = 0
      }
      if (values.length >= 4) {
        sourceLine += values[2]
        table[generated + 1] ??= sourceLine + 1
      }
    }
  })
  return line => {
    for (let at = line; at >= 1; at--) if (table[at] !== undefined) return table[at]
    return undefined
  }
}

/** Python helpers for free runs: a fresh namespace, stdin for input(), and the last expression's repr. */
export const PY_FREE_HARNESS = `
import ast as _devprep_ast
import io as _devprep_io
import sys as _devprep_sys

def _devprep_free(code, stdin):
    reader = _devprep_io.StringIO(stdin)
    def _input(prompt=""):
        if prompt != "":
            _devprep_sys.stdout.write(str(prompt))
        line = reader.readline()
        if line == "":
            raise EOFError("EOF when reading a line (the input box has no more lines)")
        return line[:-1] if line.endswith("\\n") else line
    namespace = {"__name__": "__main__", "input": _input}
    saved = _devprep_sys.stdin
    _devprep_sys.stdin = reader
    try:
        tree = _devprep_ast.parse(code, "main.py", "exec")
        last = None
        if tree.body and isinstance(tree.body[-1], _devprep_ast.Expr):
            last = _devprep_ast.Expression(tree.body.pop().value)
        exec(compile(tree, "main.py", "exec"), namespace)
        if last is not None:
            value = eval(compile(last, "main.py", "eval"), namespace)
            if value is not None:
                text = repr(value)
                return text if len(text) <= ${VALUE_LIMIT} else text[:${VALUE_LIMIT}] + "…"
        return None
    finally:
        _devprep_sys.stdin = saved
        _devprep_sys.stdout.flush()
        _devprep_sys.stderr.flush()
`

/** Keeps the learner's frames of a Python traceback and finds the line of the error. */
export function pythonFreeError(error: unknown): { error: string; line?: number } {
  const message = error instanceof Error ? error.message : String(error)
  const lines = message.trim().split('\n')
  const start = lines.findIndex(line => line.includes('"main.py"'))
  const kept = (start >= 0 ? lines.slice(start) : lines.slice(-1)).filter(line => !line.includes('_devprep_'))
  let line: number | undefined
  for (const text of kept) {
    const match = /"main\.py", line (\d+)/.exec(text)
    if (match) line = Number(match[1])
  }
  const body = kept.slice(-12)
  return { error: (/^\s*File /.test(body[0] ?? '') ? ['Traceback (most recent call last):', ...body] : body).join('\n') || message, ...line ? { line } : {} }
}

type PyCallable = ((...args: unknown[]) => unknown) & { destroy?: () => void }

/** Runs a Python program with an initialised Pyodide (PY_FREE_HARNESS must already have run). */
export function runPythonFree(py: { globals: object }, { code, stdin }: FreeRunRequest, flushOutput: () => string = () => ''): FreeRunResult {
  const started = now()
  const run = (py.globals as { get(name: string): unknown }).get('_devprep_free') as PyCallable
  try {
    const value = run(code, stdin) as string | undefined
    return { kind: 'done', output: truncate(flushOutput(), FREE_OUTPUT_LIMIT), ...typeof value === 'string' ? { value } : {}, ms: Math.round(now() - started) }
  } catch (error) {
    return { kind: 'error', output: truncate(flushOutput(), FREE_OUTPUT_LIMIT), ...pythonFreeError(error), ms: Math.round(now() - started) }
  }
}

/** Playground globals, declared on one line so diagnostics shift by a fixed amount. */
const FREE_DECLARATIONS = 'declare const stdin: string; declare function readline(): string | null; declare function input(prompt?: unknown): string | null;'
const MAIN = 'async function __devprep_main() {'

/**
 * Type-checks and runs a Playground program. It is wrapped in an async function, so top-level await and
 * return work and its own names may shadow the helpers. Type errors are reported, but the code still runs.
 */
export async function runTypeScriptFree(instance: Pick<ReturnType<typeof createTsCompiler>, 'check' | 'transpileMapped'>, request: FreeRunRequest): Promise<FreeRunResult> {
  const lines = request.code.split('\n').length
  let diagnostics: TypeDiagnostic[]
  let program: { code: string; mappings: string }
  try {
    diagnostics = instance.check(`${FREE_DECLARATIONS}\n${MAIN}\n${request.code}\n}`)
      .map(diagnostic => ({ ...diagnostic, line: diagnostic.line - 2 }))
      .filter(diagnostic => diagnostic.line >= 1 && diagnostic.line <= lines)
    program = instance.transpileMapped(`${MAIN}\n${request.code}\n}`)
  } catch (error) {
    return { kind: 'error' as const, output: '', error: error instanceof Error ? error.message : String(error), ms: 0 }
  }
  const toSource = sourceLineMap(program.mappings)
  const result = await runJsFree({ code: `${program.code}\nreturn __devprep_main()`, stdin: request.stdin }, {
    lineMap: line => { const source = toSource(line); return source && source > 1 && source <= lines + 1 ? source - 1 : undefined },
  })
  return diagnostics.length ? { ...result, diagnostics } : result
}