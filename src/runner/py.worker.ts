import type { PyodideAPI } from 'pyodide'
import { OUTPUT_LIMIT, PY_HARNESS, runPython, type RunRequest } from './core'

export type PyWorkerMessage = { type: 'init'; indexURL: string } | ({ type: 'run' } & RunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let runtime: Promise<PyodideAPI> | undefined
let output = ''

const append = (line: string) => { if (output.length <= OUTPUT_LIMIT) output += `${line}\n` }
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
  scope.postMessage({ type: 'result', result: runPython(py, message, flush) })
}
