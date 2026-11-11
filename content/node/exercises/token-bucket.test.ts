import { createLimiter } from './index'

function setup(capacity = 3, refillPerSecond = 1) {
  const clock = { t: 0 }
  return { clock, take: createLimiter({ capacity, refillPerSecond, now: () => clock.t }) }
}

export function testAllowsABurstUpToCapacity() {
  const { take } = setup()
  assertEqual([take('a'), take('a'), take('a')], [
    { allowed: true, remaining: 2 }, { allowed: true, remaining: 1 }, { allowed: true, remaining: 0 },
  ])
  assertEqual(take('a'), { allowed: false, retryAfterMs: 1000 })
}

export function testRefillsOverTime() {
  const { take, clock } = setup(3, 2)
  take('a'); take('a'); take('a')
  clock.t = 250
  assertEqual(take('a'), { allowed: false, retryAfterMs: 250 })
  clock.t = 500
  assertEqual(take('a'), { allowed: true, remaining: 0 })
}

export function testNeverExceedsCapacity() {
  const { take, clock } = setup(2, 1)
  clock.t = 60_000
  take('a')
  take('a')
  assertEqual(take('a').allowed, false)
}

export function testClientsAreIndependent() {
  const { take } = setup(1, 1)
  assertEqual(take('a').allowed, true)
  assertEqual(take('a').allowed, false)
  assertEqual(take('b').allowed, true)
}
