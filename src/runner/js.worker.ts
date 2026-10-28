import { runJs, type RunRequest } from './core'
import { blockNetwork, runJsFree, type FreeRunRequest } from './free'

/** Problems post a RunRequest; the Playground posts a free run, which also turns off network access. */
export type JsWorkerMessage = RunRequest | ({ type: 'free' } & FreeRunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope

/** V8 reports syntax errors in new Function() without a position, so parse once more to find the line. */
async function syntaxLine(code: string) {
  const { parser } = await import('@lezer/javascript')
  const tree = parser.parse(code)
  let at: number | undefined
  tree.iterate({ enter: node => { if (at === undefined && node.type.isError) at = node.from; return at === undefined } })
  return at === undefined ? undefined : code.slice(0, at).split('\n').length
}

scope.onmessage = async (event: MessageEvent<JsWorkerMessage>) => {
  const message = event.data
  if ('type' in message && message.type === 'free') {
    blockNetwork(scope)
    scope.postMessage(await runJsFree(message, { syntaxLine }))
    return
  }
  scope.postMessage(runJs(message as RunRequest))
}