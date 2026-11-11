export interface FakeClock {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  setInterval(fn: () => void, ms: number): number
  clearTimer(id: number): void
  tick(ms: number): void
}

interface Timer { due: number; seq: number; fn: () => void; every?: number }

export function createFakeClock(): FakeClock {
  let time = 0
  let nextId = 1
  let seq = 0
  const timers = new Map<number, Timer>()
  const add = (fn: () => void, ms: number, every?: number) => {
    const id = nextId++
    timers.set(id, { due: time + Math.max(0, ms), seq: seq++, fn, every })
    return id
  }
  return {
    now: () => time,
    setTimeout: (fn, ms) => add(fn, ms),
    setInterval: (fn, ms) => add(fn, Math.max(1, ms), Math.max(1, ms)),
    clearTimer: id => { timers.delete(id) },
    tick(ms) {
      const end = time + ms
      for (;;) {
        let pick: [number, Timer] | undefined
        for (const entry of timers) {
          const t = entry[1]
          if (t.due > end) continue
          if (!pick || t.due < pick[1].due || (t.due === pick[1].due && t.seq < pick[1].seq)) pick = entry
        }
        if (!pick) break
        const [id, timer] = pick
        time = timer.due
        if (timer.every) timers.set(id, { ...timer, due: timer.due + timer.every, seq: seq++ })
        else timers.delete(id)
        timer.fn()
      }
      time = end
    },
  }
}
