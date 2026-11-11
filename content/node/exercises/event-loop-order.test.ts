import { runLoop } from './index'

export function testSyncThenMicrotasksThenTimers() {
  const out = runLoop(api => {
    api.log('A')
    api.timeout(() => api.log('B'), 0)
    api.microtask(() => api.log('C'))
    api.log('D')
  })
  assertEqual(out, ['A', 'D', 'C', 'B'])
}

export function testNextTickBeforeMicrotasks() {
  const out = runLoop(api => {
    api.microtask(() => api.log('promise'))
    api.nextTick(() => api.log('tick'))
    api.log('sync')
  })
  assertEqual(out, ['sync', 'tick', 'promise'])
}

export function testTimersByDueTimeThenOrder() {
  const out = runLoop(api => {
    api.timeout(() => api.log('slow'), 20)
    api.timeout(() => api.log('fast-1'), 5)
    api.timeout(() => api.log('fast-2'), 5)
  })
  assertEqual(out, ['fast-1', 'fast-2', 'slow'])
}

export function testMicrotasksDrainBetweenTimers() {
  const out = runLoop(api => {
    api.timeout(() => { api.log('t1'); api.microtask(() => api.log('m1')) }, 0)
    api.timeout(() => api.log('t2'), 0)
  })
  assertEqual(out, ['t1', 'm1', 't2'])
}

export function testNestedTimersUseTheSimulatedClock() {
  const out = runLoop(api => {
    api.timeout(() => { api.log('a'); api.timeout(() => api.log('c'), 10) }, 10)
    api.timeout(() => api.log('b'), 15)
  })
  assertEqual(out, ['a', 'b', 'c'])
}

export function testTickQueuedFromMicrotaskRunsBeforeNextMicrotask() {
  const out = runLoop(api => {
    api.microtask(() => { api.log('m1'); api.nextTick(() => api.log('tick')) })
    api.microtask(() => api.log('m2'))
  })
  assertEqual(out, ['m1', 'tick', 'm2'])
}
