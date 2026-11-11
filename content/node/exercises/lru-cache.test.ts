import { LruCache } from './index'

function setup(max = 2, ttl = 1000) {
  const clock = { t: 0 }
  return { clock, cache: new LruCache<string, number>(max, ttl, () => clock.t) }
}

export function testStoresAndReads() {
  const { cache } = setup()
  cache.set('a', 1)
  assertEqual(cache.get('a'), 1)
  assertEqual(cache.get('missing'), undefined)
}

export function testEvictsLeastRecentlyUsed() {
  const { cache } = setup()
  cache.set('a', 1)
  cache.set('b', 2)
  cache.get('a')
  cache.set('c', 3)
  assertEqual(cache.get('b'), undefined)
  assertEqual(cache.get('a'), 1)
  assertEqual(cache.get('c'), 3)
}

export function testSetRefreshesRecency() {
  const { cache } = setup()
  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('a', 10)
  cache.set('c', 3)
  assertEqual(cache.get('a'), 10)
  assertEqual(cache.get('b'), undefined)
}

export function testExpiresEntries() {
  const { cache, clock } = setup(5, 100)
  cache.set('a', 1)
  clock.t = 100
  assertEqual(cache.get('a'), 1)
  clock.t = 101
  assertEqual(cache.get('a'), undefined)
  assertEqual(cache.size, 0)
}

export function testSetResetsTheTimer() {
  const { cache, clock } = setup(5, 100)
  cache.set('a', 1)
  clock.t = 80
  cache.set('a', 2)
  clock.t = 150
  assertEqual(cache.get('a'), 2)
}
