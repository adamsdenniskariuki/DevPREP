export interface FakeClock {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  setInterval(fn: () => void, ms: number): number
  clearTimer(id: number): void
  tick(ms: number): void
}

export function createFakeClock(): FakeClock {
  let time = 0
  // TODO: schedule instead of running at once.
  return {
    now: () => time,
    setTimeout: fn => { fn(); return 0 },
    setInterval: fn => { fn(); return 0 },
    clearTimer: () => {},
    tick: ms => { time += ms },
  }
}
