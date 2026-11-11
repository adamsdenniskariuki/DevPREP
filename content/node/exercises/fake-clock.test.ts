import { createFakeClock } from './index'

export function testNothingRunsBeforeTick() {
  const clock = createFakeClock()
  let ran = false
  clock.setTimeout(() => { ran = true }, 0)
  assertEqual(ran, false)
  clock.tick(0)
  assertEqual(ran, true)
}

export function testRunsInTimeOrder() {
  const clock = createFakeClock()
  const log: string[] = []
  clock.setTimeout(() => log.push(`b@${clock.now()}`), 20)
  clock.setTimeout(() => log.push(`a@${clock.now()}`), 10)
  clock.setTimeout(() => log.push(`c@${clock.now()}`), 20)
  clock.tick(15)
  assertEqual(log, ['a@10'])
  clock.tick(5)
  assertEqual(log, ['a@10', 'b@20', 'c@20'])
  assertEqual(clock.now(), 20)
}

export function testIntervalsRepeatAndCanBeCleared() {
  const clock = createFakeClock()
  const log: number[] = []
  const id = clock.setInterval(() => log.push(clock.now()), 10)
  clock.tick(35)
  assertEqual(log, [10, 20, 30])
  clock.clearTimer(id)
  clock.tick(100)
  assertEqual(log, [10, 20, 30])
}

export function testTimersScheduledDuringTick() {
  const clock = createFakeClock()
  const log: number[] = []
  clock.setTimeout(() => { log.push(clock.now()); clock.setTimeout(() => log.push(clock.now()), 5) }, 10)
  clock.tick(20)
  assertEqual(log, [10, 15])
}

export function testClearTimeout() {
  const clock = createFakeClock()
  let ran = false
  const id = clock.setTimeout(() => { ran = true }, 5)
  clock.clearTimer(id)
  clock.tick(10)
  assertEqual(ran, false)
}
