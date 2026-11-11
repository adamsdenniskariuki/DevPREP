import { createLockReducer, initialLock } from './index'

const reduce = createLockReducer(60_000)

function run(events: Parameters<typeof reduce>[1][]) {
  return events.reduce(reduce, initialLock)
}

export function testShortTripStaysUnlocked() {
  const state = run([{ type: 'change', next: 'inactive', at: 0 }, { type: 'change', next: 'background', at: 100 }, { type: 'change', next: 'active', at: 30_000 }])
  assertEqual(state, { appState: 'active', backgroundedAt: null, locked: false })
}

export function testLongTripLocks() {
  const state = run([{ type: 'change', next: 'background', at: 1_000 }, { type: 'change', next: 'active', at: 61_000 }])
  assertEqual(state.locked, true)
  assertEqual(reduce(state, { type: 'unlock' }).locked, false)
}

export function testInactiveNeverLocks() {
  const state = run([{ type: 'change', next: 'inactive', at: 0 }, { type: 'change', next: 'active', at: 500_000 }])
  assertEqual(state.locked, false)
}

export function testKeepsEarliestBackgroundTime() {
  const state = run([
    { type: 'change', next: 'background', at: 0 },
    { type: 'change', next: 'inactive', at: 50_000 },
    { type: 'change', next: 'background', at: 55_000 },
    { type: 'change', next: 'active', at: 60_000 },
  ])
  assertEqual(state.locked, true)
}

export function testSameStateIsIgnored() {
  assert(reduce(initialLock, { type: 'change', next: 'active', at: 5 }) === initialLock)
}
