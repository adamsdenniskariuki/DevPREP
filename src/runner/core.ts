import type { CodeLanguage, ProblemTest } from '../problem-types'

export const RESULT_PREVIEW_LIMIT = 500
export const OUTPUT_LIMIT = 4000
export const TIMEOUT_MS: Record<CodeLanguage, number> = { js: 5000, py: 10000 }

export interface CaseOutcome {
  pass: boolean
  /** JSON text of the returned value (undefined when the call threw or returned nothing). */
  actual?: string
  error?: string
  ms: number
}

export interface RunRequest {
  code: string
  name: string
  cases: ProblemTest[]
  /** TypeScript only: type-level assertions compiled after the code. They never run; they must type-check. */
  typeChecks?: string
}

/** Outcome of an exercise's type checks. Error lines are relative to the type-check block. */
export interface TypeCheckOutcome {
  pass: boolean
  errors: TypeDiagnostic[]
}

export type RunResponse =
  | { kind: 'done'; outcomes: CaseOutcome[]; output: string; diagnostics?: TypeDiagnostic[]; typeChecks?: TypeCheckOutcome }
  | { kind: 'error'; error: string; output: string; diagnostics?: TypeDiagnostic[] }

/** A TypeScript type error in learner code (TypeScript labs only; the code still runs). */
export interface TypeDiagnostic {
  line: number
  column: number
  code: number
  message: string
}

/** Structural equality over JSON values. Object key order is ignored; numbers compare exactly. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    return a.length === other.length && a.every((item, index) => deepEqual(item, other[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
}

export function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}… (${text.length - limit} more characters)` : text
}

function pythonLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(', ')}]`
  return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}: ${pythonLiteral(item)}`).join(', ')}}`
}

/** Formats a JSON value as a literal in the chosen language, for display. */
export function formatValue(value: unknown, lang: CodeLanguage, limit = RESULT_PREVIEW_LIMIT): string {
  const text = lang === 'py' ? pythonLiteral(value) : value === undefined ? 'undefined' : JSON.stringify(value)
  return truncate(text, limit)
}

export function formatArgs(args: unknown[], lang: CodeLanguage, limit = RESULT_PREVIEW_LIMIT): string {
  return truncate(args.map(arg => formatValue(arg, lang, Infinity)).join(', '), limit)
}

export function isPassing(outcome: CaseOutcome, expected: unknown): boolean {
  if (outcome.error !== undefined || outcome.actual === undefined) return false
  return deepEqual(JSON.parse(outcome.actual), expected)
}

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now())

function safeStringify(value: unknown): string {
  try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/** Runs a JavaScript solution against cases in the current realm (the app calls it from a worker). */
export function runJs({ code, name, cases }: RunRequest): RunResponse {
  const output: string[] = []
  let size = 0
  const write = (...parts: unknown[]) => {
    if (size > OUTPUT_LIMIT) return
    const line = parts.map(part => (typeof part === 'string' ? part : safeStringify(part))).join(' ')
    size += line.length + 1
    output.push(line)
  }
  const fakeConsole = { log: write, info: write, warn: write, error: write, debug: write }
  const flush = () => truncate(output.join('\n'), OUTPUT_LIMIT)
  let fn: unknown
  try {
    fn = new Function('console', `"use strict";\n${code}\n;return typeof ${name} === 'function' ? ${name} : undefined`)(fakeConsole)
  } catch (error) {
    return { kind: 'error', error: describeError(error), output: flush() }
  }
  if (typeof fn !== 'function') return { kind: 'error', error: `Define a function named ${name}.`, output: flush() }
  const outcomes = cases.map((test): CaseOutcome => {
    const started = now()
    try {
      const value = (fn as (...args: unknown[]) => unknown)(...structuredClone(test.args))
      const outcome: CaseOutcome = { pass: false, actual: value === undefined ? undefined : JSON.stringify(value), ms: now() - started }
      outcome.pass = isPassing(outcome, test.expected)
      return outcome
    } catch (error) {
      return { pass: false, error: describeError(error), ms: now() - started }
    }
  })
  return { kind: 'done', outcomes, output: flush() }
}

/**
 * Like runJs, but awaits promise results (with a per-case limit) so async and event-loop exercises can be tested.
 * Used by the TypeScript runner after transpiling.
 */
export async function runJsAsync({ code, name, cases }: RunRequest, caseLimitMs = 3000): Promise<RunResponse> {
  const output: string[] = []
  let size = 0
  const write = (...parts: unknown[]) => {
    if (size > OUTPUT_LIMIT) return
    const line = parts.map(part => (typeof part === 'string' ? part : safeStringify(part))).join(' ')
    size += line.length + 1
    output.push(line)
  }
  const fakeConsole = { log: write, info: write, warn: write, error: write, debug: write }
  const flush = () => truncate(output.join('\n'), OUTPUT_LIMIT)
  let fn: unknown
  try {
    fn = new Function('console', `"use strict";\n${code}\n;return typeof ${name} === 'function' ? ${name} : undefined`)(fakeConsole)
  } catch (error) {
    return { kind: 'error', error: describeError(error), output: flush() }
  }
  if (typeof fn !== 'function') return { kind: 'error', error: `Define a function named ${name}.`, output: flush() }
  const outcomes: CaseOutcome[] = []
  for (const test of cases) {
    const started = now()
    try {
      let value = (fn as (...args: unknown[]) => unknown)(...structuredClone(test.args))
      if (value && typeof (value as PromiseLike<unknown>).then === 'function') {
        let timer: ReturnType<typeof setTimeout> | undefined
        const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`The promise did not settle within ${caseLimitMs / 1000} s.`)), caseLimitMs) })
        try { value = await Promise.race([value, limit]) } finally { clearTimeout(timer) }
      }
      const outcome: CaseOutcome = { pass: false, actual: value === undefined ? undefined : JSON.stringify(value), ms: now() - started }
      outcome.pass = isPassing(outcome, test.expected)
      outcomes.push(outcome)
    } catch (error) {
      outcomes.push({ pass: false, error: describeError(error), ms: now() - started })
    }
  }
  return { kind: 'done', outcomes, output: flush() }
}

/** Python helpers, executed once per interpreter. Each solution runs in a fresh namespace. */
export const PY_HARNESS = `
import json as _devprep_json

def _devprep_define(code, name):
    namespace = {"__name__": "__solution__"}
    exec(compile(code, "solution.py", "exec"), namespace)
    fn = namespace.get(name)
    if not callable(fn):
        raise NameError(f"Define a function named {name}.")
    return fn

def _devprep_call(fn, args_json):
    return _devprep_json.dumps(fn(*_devprep_json.loads(args_json)))
`

/** Minimal surface of a Pyodide instance (lets tests drive Node Pyodide with the same code). */
export interface PythonRuntime {
  globals: object
}

type PyCallable = ((...args: unknown[]) => unknown) & { destroy?: () => void }

/** Keeps the user-facing end of a Python traceback and drops harness/runtime frames. */
export function pythonMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lines = message.trim().split('\n')
  const start = lines.findIndex(line => line.includes('"solution.py"'))
  const kept = (start >= 0 ? lines.slice(start) : lines.slice(-1)).filter(line => !line.includes('_devprep_'))
  return kept.slice(-8).join('\n') || message
}

/** Runs a Python solution with an initialised Pyodide (PY_HARNESS must already have run). */
export function runPython(py: PythonRuntime, { code, name, cases }: RunRequest, flushOutput: () => string = () => ''): RunResponse {
  const globals = py.globals as { get(name: string): unknown }
  const define = globals.get('_devprep_define') as PyCallable
  const call = globals.get('_devprep_call') as PyCallable
  let fn: PyCallable
  try {
    fn = define(code, name) as PyCallable
  } catch (error) {
    return { kind: 'error', error: pythonMessage(error), output: truncate(flushOutput(), OUTPUT_LIMIT) }
  }
  try {
    const outcomes = cases.map((test): CaseOutcome => {
      const started = now()
      try {
        const outcome: CaseOutcome = { pass: false, actual: call(fn, JSON.stringify(test.args)) as string, ms: now() - started }
        outcome.pass = isPassing(outcome, test.expected)
        return outcome
      } catch (error) {
        return { pass: false, error: pythonMessage(error), ms: now() - started }
      }
    })
    return { kind: 'done', outcomes, output: truncate(flushOutput(), OUTPUT_LIMIT) }
  } finally {
    fn.destroy?.()
  }
}
