import type { CodeLanguage } from '../problem-types'
import { TIMEOUT_MS, type RunRequest, type RunResponse } from './core'
import { PYODIDE_VERSION } from './pyodide-version'
import type { PyWorkerMessage } from './py.worker'

export type RunReport =
  | RunResponse
  | { kind: 'timeout'; ms: number }
  | { kind: 'load-error'; error: string }

export type RunPhase = 'loading-python' | 'running'

const PYTHON_LOAD_TIMEOUT_MS = 180_000
let jsWorker: Worker | undefined
let pyWorker: Worker | undefined
let pyReady: Promise<void> | undefined
let queue: Promise<unknown> = Promise.resolve()

export function pyodideIndexURL(base = document.baseURI) {
  return new URL(`pyodide/${PYODIDE_VERSION}/`, base).href
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

async function runOnce(lang: CodeLanguage, request: RunRequest, onPhase: (phase: RunPhase) => void): Promise<RunReport> {
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
export function runCode(lang: CodeLanguage, request: RunRequest, onPhase: (phase: RunPhase) => void = () => {}): Promise<RunReport> {
  const next = queue.then(() => runOnce(lang, request, onPhase))
  queue = next.catch(() => undefined)
  return next
}
