import type { PyodideAPI } from 'pyodide'
import { OUTPUT_LIMIT, PY_HARNESS, runPython, type ProgressMessage, type RunRequest } from './core'
import { isPyPackage } from './pyodide-version'
import { blockNetwork, FREE_OUTPUT_LIMIT, PY_FREE_HARNESS, runPythonFree, type FreeRunRequest } from './free'

export type PyWorkerMessage = { type: 'init'; indexURL: string; packages?: string[] } | ({ type: 'run' } & RunRequest) | ({ type: 'free' } & FreeRunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let runtime: Promise<PyodideAPI> | undefined
let freeReady = false
let output = ''

const append = (line: string) => { if (output.length <= Math.max(OUTPUT_LIMIT, FREE_OUTPUT_LIMIT)) output += `${line}\n` }
const flush = () => { const text = output.replace(/\n$/, ''); output = ''; return text }

function load(indexURL: string, packages: string[]) {
  runtime ??= (async () => {
    const wanted = [...new Set(packages)]
    const refused = wanted.find(name => !isPyPackage(name))
    if (refused !== undefined) throw new Error(`The Python package "${refused}" is not available.`)
    const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`) as typeof import('pyodide')
    const py = await loadPyodide({ indexURL, stdout: append, stderr: append })
    // Allowlisted packages only, from the app's own pyodide/<version>/ folder, checked against the lock file's hashes.
    if (wanted.length) await py.loadPackage(wanted, { checkIntegrity: true, messageCallback: () => {}, errorCallback: () => {} })
    py.runPython(PY_HARNESS)
    // Pyodide and its packages are loaded, so its own downloads are done: turn off fetch and friends before any
    // learner code runs (pyodide.http, loadPackage and the js module all go through them).
    blockNetwork(scope)
    return py
  })()
  return runtime
}

scope.onmessage = async (event: MessageEvent<PyWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      await load(message.indexURL, message.packages ?? [])
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      runtime = undefined
      scope.postMessage({ type: 'load-error', error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  const py = await runtime!
  output = ''
  if (message.type === 'free') {
    if (!freeReady) {
      py.runPython(PY_FREE_HARNESS)
      freeReady = true
    }
    scope.postMessage({ type: 'result', result: runPythonFree(py, message, flush) })
    return
  }
  scope.postMessage({ type: 'result', result: runPython(py, message, flush, done => scope.postMessage({ type: 'progress', done } satisfies ProgressMessage)) })
}
