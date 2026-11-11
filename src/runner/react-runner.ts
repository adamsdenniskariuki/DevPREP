import harness from './react-harness.js?raw'
import { compileReactFiles, type ProjectReport, type RunPhase } from './runner'
import { REACT_APP_FILE, REACT_TEST_FILE, REACT_TEST_TIMEOUT_MS, REACT_TIMEOUT_MS } from './react-core'
import type { ProjectResponse } from './project'

/** React itself, as CommonJS sources. Loaded on the first run and cached by the service worker. */
async function reactSources(): Promise<Record<string, string>> {
  const [react, jsx, dom, client, scheduler] = await Promise.all([
    import('../../node_modules/react/cjs/react.production.js?raw'),
    import('../../node_modules/react/cjs/react-jsx-runtime.production.js?raw'),
    import('../../node_modules/react-dom/cjs/react-dom.production.js?raw'),
    import('../../node_modules/react-dom/cjs/react-dom-client.production.js?raw'),
    import('../../node_modules/scheduler/cjs/scheduler.production.js?raw'),
  ])
  return { react: react.default, 'react/jsx-runtime': jsx.default, 'react-dom': dom.default, 'react-dom/client': client.default, scheduler: scheduler.default }
}

// The iframe has an opaque origin (no allow-same-origin) and a CSP that blocks every network request.
const SRCDOC = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:">
<style>body{font:15px/1.5 system-ui,sans-serif;margin:12px;color:#1b1f24;background:#fff}#tests{position:absolute;left:-10000px;top:0;width:800px}button,input,select,textarea{font:inherit}</style>
</head><body><div id="tests" aria-hidden="true"></div><div id="preview"></div><script>
addEventListener('message', function (event) {
  if (event.source !== parent || !event.data || event.data.type !== 'devprep-react') return
  var post = function (message) { parent.postMessage(Object.assign({ devprep: 'react' }, message), '*') }
  try {
    ;(0, eval)(event.data.harness)
    globalThis.__devprepRunReact(event.data.payload, post).catch(function (error) { post({ type: 'result', result: { kind: 'error', error: String(error && error.message || error), output: '' } }) })
  } catch (error) {
    post({ type: 'result', result: { kind: 'error', error: String(error && error.message || error), output: '' } })
  }
}, { once: true })
parent.postMessage({ devprep: 'react', type: 'ready' }, '*')
</script></body></html>`

export interface ReactRunOptions {
  onPhase?: (phase: RunPhase) => void
  /** How many tests the suite has, once the tests file has loaded. */
  onTotal?: (total: number) => void
  onProgress?: (done: number) => void
  /** Where the sandbox iframe (and its live preview) goes. Any previous iframe there is replaced. */
  host: HTMLElement
  /** Accessible name for the preview frame. */
  title: string
}

/** Runs a React exercise: compiles App.tsx and its tests, then runs them in a sandboxed iframe that also shows the live preview. */
export async function runReact(app: string, tests: string, { host, title, onPhase = () => {}, onTotal = () => {}, onProgress = () => {} }: ReactRunOptions): Promise<ProjectReport> {
  const compiled = await compileReactFiles({ [REACT_APP_FILE]: app, [REACT_TEST_FILE]: tests }, onPhase)
  if ('kind' in compiled) return compiled
  if (compiled.diagnostics.length) {
    return { kind: 'error', error: 'Your code has syntax errors, so the tests could not run.', output: '', diagnostics: compiled.diagnostics }
  }
  onPhase('loading-react')
  let sources: Record<string, string>
  try {
    sources = await reactSources()
  } catch (error) {
    return { kind: 'load-error', error: error instanceof Error ? error.message : String(error) }
  }
  onPhase('running')
  host.replaceChildren()
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.className = 'react-preview-frame'
  frame.title = title
  frame.srcdoc = SRCDOC
  const started = performance.now()
  return new Promise<ProjectReport>(resolve => {
    const finish = (report: ProjectReport) => {
      clearTimeout(timer)
      removeEventListener('message', onMessage)
      resolve(report)
    }
    const timer = setTimeout(() => {
      // The page may be frozen in a loop the guard could not reach; removing the frame stops it.
      frame.remove()
      finish({ kind: 'timeout', ms: Math.round(performance.now() - started), limitMs: REACT_TIMEOUT_MS })
    }, REACT_TIMEOUT_MS)
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const data = event.data as { devprep?: string; type?: string; total?: number; done?: number; result?: ProjectResponse }
      if (data?.devprep !== 'react') return
      if (data.type === 'ready') {
        frame.contentWindow!.postMessage({ type: 'devprep-react', harness, payload: { sources, modules: compiled.modules, testTimeoutMs: REACT_TEST_TIMEOUT_MS, preview: true } }, '*')
      } else if (data.type === 'total' && typeof data.total === 'number') {
        onTotal(data.total)
      } else if (data.type === 'progress' && typeof data.done === 'number') {
        onProgress(data.done)
      } else if (data.type === 'result' && data.result) {
        finish(data.result)
      }
    }
    addEventListener('message', onMessage)
    host.append(frame)
  })
}
