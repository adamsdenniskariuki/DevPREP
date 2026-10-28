import type { PyodideAPI } from 'pyodide'
import { OUTPUT_LIMIT, PY_HARNESS, runPython, type RunRequest } from './core'
import { blockNetwork, FREE_OUTPUT_LIMIT, PY_FREE_HARNESS, runPythonFree, type FreeRunRequest } from './free'

export type PyWorkerMessage = { type: 'init'; indexURL: string } | ({ type: 'run' } & RunRequest) | ({ type: 'free' } & FreeRunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let runtime: Promise<PyodideAPI> | undefined
let freeReady = false
let output = ''

const append = (line: string) => { if (output.length <= Math.max(OUTPUT_LIMIT, FREE_OUTPUT_LIMIT)) output += `${line}\n` }
const flush = () => { const text = output.replace(/\n$/, ''); output = ''; return text }

function load(indexURL: string) {
  runtime ??= (async () => {
    const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`) as typeof import('pyodide')
    const py = await loadPyodide({ indexURL, stdout: append, stderr: append })
    py.runPython(PY_HARNESS)
    return py
  })()
  return runtime
}

scope.onmessage = async (event: MessageEvent<PyWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      await load(message.indexURL)
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
      // Pyodide is loaded, so its own downloads are done: turn off fetch and friends for learner code
      // (pyodide.http and the js module both go through them). No packages beyond the standard library.
      blockNetwork(scope)
      py.runPython(PY_FREE_HARNESS)
      freeReady = true
    }
    scope.postMessage({ type: 'result', result: runPythonFree(py, message, flush) })
    return
  }
  scope.postMessage({ type: 'result', result: runPython(py, message, flush) })
}