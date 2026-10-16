import type { TypeScriptApi } from './ts-core'
import { createTsCompiler, formatDiagnostic, type TsDiagnostic } from './ts-core'
import { runJsAsync, type RunRequest, type RunResponse } from './core'

export type TsWorkerMessage = { type: 'init'; baseURL: string } | ({ type: 'run' } & RunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let compiler: Promise<ReturnType<typeof createTsCompiler>> | undefined

async function text(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${url.split('/').pop()} (HTTP ${response.status}).`)
  return response.text()
}

function load(baseURL: string) {
  compiler ??= (async () => {
    const [source, libs] = await Promise.all([text(`${baseURL}typescript.js`), text(`${baseURL}libs.json`)])
    // typescript.js is a classic script that declares a global `ts`; indirect eval runs it in global scope.
    ;(0, eval)(`${source}\n;globalThis.ts = ts;`)
    const ts = (globalThis as unknown as { ts: TypeScriptApi }).ts
    const instance = createTsCompiler(ts, JSON.parse(libs) as Record<string, string>)
    instance.check('const warm: number = 1')
    return instance
  })()
  return compiler
}

scope.onmessage = async (event: MessageEvent<TsWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      await load(message.baseURL)
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      compiler = undefined
      scope.postMessage({ type: 'load-error', error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  const instance = await compiler!
  let diagnostics: TsDiagnostic[] = []
  let code: string
  try {
    diagnostics = instance.check(message.code)
    code = instance.transpile(message.code)
  } catch (error) {
    scope.postMessage({ type: 'result', result: { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '', diagnostics } })
    return
  }
  const response = await runJsAsync({ ...message, code })
  const result: RunResponse = response.kind === 'error' && diagnostics.length
    ? { ...response, error: `${response.error}\n\nType errors:\n${diagnostics.map(formatDiagnostic).join('\n')}`, diagnostics }
    : { ...response, diagnostics }
  scope.postMessage({ type: 'result', result })
}
