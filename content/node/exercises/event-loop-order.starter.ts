export interface LoopApi {
  log(message: string): void
  nextTick(fn: () => void): void
  microtask(fn: () => void): void
  timeout(fn: () => void, ms: number): void
}

export function runLoop(main: (api: LoopApi) => void): string[] {
  const out: string[] = []
  // TODO: queue callbacks instead of running them immediately, and drain them in Node's order.
  const api: LoopApi = {
    log: message => { out.push(message) },
    nextTick: fn => fn(),
    microtask: fn => fn(),
    timeout: fn => fn(),
  }
  main(api)
  return out
}
