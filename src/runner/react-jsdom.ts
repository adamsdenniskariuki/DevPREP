import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { compileReact, REACT_APP_FILE, REACT_TEST_FILE } from './react-core'
import type { ProjectResponse } from './project'
import type { TypeScriptApi } from './ts-core'
import './react-harness.js'

/** Test-only helper: needs a jsdom environment and Node file access. */
const modules = join(process.cwd(), 'node_modules')
const sources = {
  react: readFileSync(join(modules, 'react/cjs/react.production.js'), 'utf8'),
  'react/jsx-runtime': readFileSync(join(modules, 'react/cjs/react-jsx-runtime.production.js'), 'utf8'),
  'react-dom': readFileSync(join(modules, 'react-dom/cjs/react-dom.production.js'), 'utf8'),
  'react-dom/client': readFileSync(join(modules, 'react-dom/cjs/react-dom-client.production.js'), 'utf8'),
  scheduler: readFileSync(join(modules, 'scheduler/cjs/scheduler.production.js'), 'utf8'),
}

type Run = (payload: unknown, post: (message: { type: string; result?: ProjectResponse; total?: number; done?: number }) => void) => Promise<void>

/** Compiles and runs an exercise the way the sandbox iframe does, returning the result and progress messages. */
export async function runReactInJsdom(app: string, tests: string, testTimeoutMs = 2000) {
  const compiled = compileReact(ts as unknown as TypeScriptApi, { [REACT_APP_FILE]: app, [REACT_TEST_FILE]: tests })
  if (compiled.diagnostics.length) return { result: { kind: 'error', error: 'syntax', output: '', diagnostics: compiled.diagnostics } as ProjectResponse, progress: [] as number[], total: 0 }
  document.body.innerHTML = '<div id="tests" aria-hidden="true"></div><div id="preview"></div>'
  const progress: number[] = []
  let total = 0
  let result: ProjectResponse | undefined
  await ((globalThis as unknown as { __devprepRunReact: Run }).__devprepRunReact)({ sources, modules: compiled.modules, testTimeoutMs, preview: true }, message => {
    if (message.type === 'total') total = message.total!
    if (message.type === 'progress') progress.push(message.done!)
    if (message.type === 'result') result = message.result
  })
  return { result: result!, progress, total }
}
