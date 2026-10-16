import type { CodeLanguage } from '../problem-types'
import { TIMEOUT_MS, type RunRequest, type RunResponse } from './core'
import { PYODIDE_VERSION } from './pyodide-version'
import type { PyWorkerMessage } from './py.worker'
import { TYPESCRIPT_VERSION } from './ts-version'
import type { TsWorkerMessage } from './ts.worker'
import { PGLITE_VERSION } from './pglite-version'
import { SQL_TIMEOUT_MS, type SqlRunRequest, type SqlRunResponse } from './sql-core'
import type { SqlWorkerMessage } from './sql.worker'

export type RunReport =
  | RunResponse
  | { kind: 'timeout'; ms: number }
  | { kind: 'load-error'; error: string }

export type RunPhase = 'loading-python' | 'loading-typescript' | 'loading-sql' | 'running'
/** Languages the runner executes: problem languages plus TypeScript (labs only). */
export type RunLanguage = CodeLanguage | 'ts'
/** TypeScript runs as JavaScript after type-checking; the extra second covers compiling. */
export const TS_TIMEOUT_MS = TIMEOUT_MS.js + 1000

const PYTHON_LOAD_TIMEOUT_MS = 180_000
const TYPESCRIPT_LOAD_TIMEOUT_MS = 120_000
const SQL_LOAD_TIMEOUT_MS = 120_000
let sqlWorker: Worker | undefined
let sqlReady: Promise<void> | undefined
let tsWorker: Worker | undefined
let tsReady: Promise<void> | undefined
let jsWorker: Worker | undefined
let pyWorker: Worker | undefined
let pyReady: Promise<void> | undefined
let queue: Promise<unknown> = Promise.resolve()

export function pyodideIndexURL(base = document.baseURI) {
  return new URL(`pyodide/${PYODIDE_VERSION}/`, base).href
}

export function typescriptBaseURL(base = document.baseURI) {
  return new URL(`typescript/${TYPESCRIPT_VERSION}/`, base).href
}

export function pgliteBaseURL(base = document.baseURI) {
  return new URL(`pglite/${PGLITE_VERSION}/`, base).href
}

function reply<T>(worker: Worker, ms: number, accept: (data: unknown) => T | undefined): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); resolve('timeout') }, ms)
    const onMessage = (event: MessageEvent) => {
      const value = accept(event.data)
      if (value !== undefined) { cleanup(); resolve(value) }
    }
    const onError = (event: ErrorEvent) => { cleanup(); reject(new Error(event.message || 'The code runner stopped unexpectedly.')) }
    const cleanup = () => {
      clearTimeout(timer)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
  })
}

function resetPython() {
  pyWorker?.terminate()
  pyWorker = undefined
  pyReady = undefined
}

/** Starts (or reuses) the Python worker and resolves once Pyodide is ready. */
export function preparePython(): Promise<void> {
  if (!pyReady) {
    const worker = new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module', name: 'devprep-python' })
    pyWorker = worker
    pyReady = (async () => {
      const done = reply(worker, PYTHON_LOAD_TIMEOUT_MS, data => {
        const message = data as { type: string; error?: string }
        if (message.type === 'ready') return 'ready'
        if (message.type === 'load-error') return `error:${message.error}`
      })
      worker.postMessage({ type: 'init', indexURL: pyodideIndexURL() } satisfies PyWorkerMessage)
      const result = await done
      if (result !== 'ready') throw new Error(result === 'timeout' ? 'Python took too long to load. Check your connection and try again.' : result.slice(6))
    })()
    pyReady.catch(resetPython)
  }
  return pyReady
}

function resetTypeScript() {
  tsWorker?.terminate()
  tsWorker = undefined
  tsReady = undefined
}

/** Starts (or reuses) the TypeScript worker and resolves once the compiler is ready. */
export function prepareTypeScript(): Promise<void> {
  if (!tsReady) {
    const worker = new Worker(new URL('./ts.worker.ts', import.meta.url), { type: 'module', name: 'devprep-typescript' })
    tsWorker = worker
    tsReady = (async () => {
      const done = reply(worker, TYPESCRIPT_LOAD_TIMEOUT_MS, data => {
        const message = data as { type: string; error?: string }
        if (message.type === 'ready') return 'ready'
        if (message.type === 'load-error') return `error:${message.error}`
      })
      worker.postMessage({ type: 'init', baseURL: typescriptBaseURL() } satisfies TsWorkerMessage)
      const result = await done
      if (result !== 'ready') throw new Error(result === 'timeout' ? 'TypeScript took too long to load. Check your connection and try again.' : result.slice(6))
    })()
    tsReady.catch(resetTypeScript)
  }
  return tsReady
}

async function runTypeScript(request: RunRequest, onPhase: (phase: RunPhase) => void): Promise<RunReport> {
  onPhase('loading-typescript')
  try {
    await prepareTypeScript()
  } catch (error) {
    return { kind: 'load-error', error: error instanceof Error ? error.message : String(error) }
  }
  const worker = tsWorker!
  onPhase('running')
  const started = performance.now()
  const pending = reply(worker, TS_TIMEOUT_MS, data => {
    const message = data as { type: string; result?: RunResponse }
    return message.type === 'result' ? message.result : undefined
  })
  worker.postMessage({ type: 'run', ...request } satisfies TsWorkerMessage)
  try {
    const result = await pending
    if (result !== 'timeout') return result
  } catch (error) {
    resetTypeScript()
    return { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '' }
  }
  // A runaway loop blocks the worker, so stop it; the next run reloads the compiler from cache.
  resetTypeScript()
  return { kind: 'timeout', ms: Math.round(performance.now() - started) }
}

function resetSql() {
  sqlWorker?.terminate()
  sqlWorker = undefined
  sqlReady = undefined
}

/** Starts (or reuses) the Postgres worker and resolves once PGlite has booted. */
export function prepareSql(): Promise<void> {
  if (!sqlReady) {
    const worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module', name: 'devprep-sql' })
    sqlWorker = worker
    sqlReady = (async () => {
      const done = reply(worker, SQL_LOAD_TIMEOUT_MS, data => {
        const message = data as { type: string; error?: string }
        if (message.type === 'ready') return 'ready'
        if (message.type === 'load-error') return `error:${message.error}`
      })
      worker.postMessage({ type: 'init', baseURL: pgliteBaseURL() } satisfies SqlWorkerMessage)
      const result = await done
      if (result !== 'ready') throw new Error(result === 'timeout' ? 'Postgres took too long to load. Check your connection and try again.' : result.slice(6))
    })()
    sqlReady.catch(resetSql)
  }
  return sqlReady
}

export type SqlReport = SqlRunResponse | { kind: 'timeout'; ms: number } | { kind: 'load-error'; error: string }

async function runSqlOnce(request: SqlRunRequest, onPhase: (phase: RunPhase) => void): Promise<SqlReport> {
  onPhase('loading-sql')
  try {
    await prepareSql()
  } catch (error) {
    return { kind: 'load-error', error: error instanceof Error ? error.message : String(error) }
  }
  const worker = sqlWorker!
  onPhase('running')
  const started = performance.now()
  const pending = reply(worker, SQL_TIMEOUT_MS, data => {
    const message = data as { type: string; fatal?: boolean; result?: SqlRunResponse }
    return message.type === 'result' ? message : undefined
  })
  worker.postMessage({ type: 'run', ...request } satisfies SqlWorkerMessage)
  try {
    const message = await pending
    if (message !== 'timeout') {
      if (message.fatal) resetSql()
      return message.result!
    }
  } catch (error) {
    resetSql()
    return { kind: 'error', error: error instanceof Error ? error.message : String(error) }
  }
  // A runaway query (say, an endless recursive CTE) cannot be cancelled inside PGlite, so stop the worker.
  // The next run boots a fresh database from the cached files.
  resetSql()
  return { kind: 'timeout', ms: Math.round(performance.now() - started) }
}

/** Runs SQL test cases on in-browser Postgres, sharing the one-at-a-time queue with the code runner. */
export function runSqlCode(request: SqlRunRequest, onPhase: (phase: RunPhase) => void = () => {}): Promise<SqlReport> {
  const next = queue.then(() => runSqlOnce(request, onPhase))
  queue = next.catch(() => undefined)
  return next
}

async function runOnce(lang: RunLanguage, request: RunRequest, onPhase: (phase: RunPhase) => void): Promise<RunReport> {
  if (lang === 'ts') return runTypeScript(request, onPhase)
  const started = performance.now()
  if (lang === 'js') {
    jsWorker ??= new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module', name: 'devprep-javascript' })
    const worker = jsWorker
    onPhase('running')
    const pending = reply(worker, TIMEOUT_MS.js, data => data as RunResponse)
    worker.postMessage(request)
    try {
      const result = await pending
      if (result !== 'timeout') return result
    } catch (error) {
      jsWorker?.terminate(); jsWorker = undefined
      return { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '' }
    }
    worker.terminate()
    jsWorker = undefined
    return { kind: 'timeout', ms: Math.round(performance.now() - started) }
  }
  onPhase('loading-python')
  try {
    await preparePython()
  } catch (error) {
    return { kind: 'load-error', error: error instanceof Error ? error.message : String(error) }
  }
  const worker = pyWorker!
  onPhase('running')
  const runStarted = performance.now()
  const pending = reply(worker, TIMEOUT_MS.py, data => {
    const message = data as { type: string; result?: RunResponse }
    return message.type === 'result' ? message.result : undefined
  })
  worker.postMessage({ type: 'run', ...request } satisfies PyWorkerMessage)
  try {
    const result = await pending
    if (result !== 'timeout') return result
  } catch (error) {
    resetPython()
    return { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '' }
  }
  // Pyodide cannot be interrupted without cross-origin isolation, so stop the worker; the next run reloads it from cache.
  resetPython()
  return { kind: 'timeout', ms: Math.round(performance.now() - runStarted) }
}

/** Runs code against test cases in a sandboxed worker, one run at a time, with a time limit. */
export function runCode(lang: RunLanguage, request: RunRequest, onPhase: (phase: RunPhase) => void = () => {}): Promise<RunReport> {
  const next = queue.then(() => runOnce(lang, request, onPhase))
  queue = next.catch(() => undefined)
  return next
}
