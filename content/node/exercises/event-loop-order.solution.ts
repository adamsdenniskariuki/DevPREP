export interface LoopApi {
  log(message: string): void
  nextTick(fn: () => void): void
  microtask(fn: () => void): void
  timeout(fn: () => void, ms: number): void
}

interface Timer { due: number; seq: number; fn: () => void }

export function runLoop(main: (api: LoopApi) => void): string[] {
  const out: string[] = []
  const ticks: Array<() => void> = []
  const micro: Array<() => void> = []
  const timers: Timer[] = []
  let now = 0
  let seq = 0
  const api: LoopApi = {
    log: message => { out.push(message) },
    nextTick: fn => { ticks.push(fn) },
    microtask: fn => { micro.push(fn) },
    timeout: (fn, ms) => { timers.push({ due: now + Math.max(0, ms), seq: seq++, fn }) },
  }
  const drain = () => {
    while (ticks.length || micro.length) {
      while (ticks.length) ticks.shift()!()
      if (micro.length) micro.shift()!()
    }
  }
  main(api)
  drain()
  while (timers.length) {
    timers.sort((a, b) => a.due - b.due || a.seq - b.seq)
    const next = timers.shift()!
    now = next.due
    next.fn()
    drain()
  }
  return out
}
