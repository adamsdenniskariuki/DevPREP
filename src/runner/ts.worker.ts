import type { TypeScriptApi } from './ts-core'
import { checkWithTypeChecks, createTsCompiler, formatDiagnostic, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS, type TsDiagnostic } from './ts-core'
import { runJsAsync, type ProgressMessage, type RunRequest, type RunResponse, type TypeCheckOutcome } from './core'
import { blockNetwork, runTypeScriptFree, type FreeRunRequest } from './free'
import { createProjectChecker, runTypeScriptProject, type ProjectDiagnostic, type ProjectRunRequest } from './project'

export type TsWorkerMessage = { type: 'init'; baseURL: string } | ({ type: 'run' } & RunRequest) | ({ type: 'free' } & FreeRunRequest) | ({ type: 'project' } & ProjectRunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let compiler: Promise<ReturnType<typeof createTsCompiler>> | undefined
let project: { ts: TypeScriptApi; check: (files: Record<string, string>) => ProjectDiagnostic[] } | undefined

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
    const parsed = JSON.parse(libs) as Record<string, string>
    const instance = createTsCompiler(ts, parsed)
    project = { ts, check: createProjectChecker(ts, parsed, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS) }
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
  if (message.type === 'free') {
    blockNetwork(scope)
    scope.postMessage({ type: 'result', result: await runTypeScriptFree(instance, message) })
    return
  }
  if (message.type === 'project') {
    blockNetwork(scope)
    scope.postMessage({ type: 'result', result: await runTypeScriptProject(project!.ts, project!.check, message, done => scope.postMessage({ type: 'progress', done } satisfies ProgressMessage)) })
    return
  }
  let diagnostics: TsDiagnostic[] = []
  let typeChecks: TypeCheckOutcome | undefined
  let code: string
  try {
    ;({ diagnostics, typeChecks } = checkWithTypeChecks(instance.check, message.code, message.typeChecks))
    code = instance.transpile(message.code)
  } catch (error) {
    scope.postMessage({ type: 'result', result: { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '', diagnostics } })
    return
  }
  const response = await runJsAsync({ ...message, code }, undefined, done => scope.postMessage({ type: 'progress', done } satisfies ProgressMessage))
  const result: RunResponse = response.kind === 'error'
    ? diagnostics.length ? { ...response, error: `${response.error}\n\nType errors:\n${diagnostics.map(formatDiagnostic).join('\n')}`, diagnostics } : { ...response, diagnostics }
    : { ...response, diagnostics, typeChecks }
  scope.postMessage({ type: 'result', result })
}
