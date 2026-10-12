import { runJs, type RunRequest } from './core'

const scope = self as unknown as DedicatedWorkerGlobalScope
scope.onmessage = (event: MessageEvent<RunRequest>) => scope.postMessage(runJs(event.data))
