import { mapLimit } from './index'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function testKeepsInputOrder() {
  const result = await mapLimit([30, 5, 15], 2, async ms => { await sleep(ms); return ms * 2 })
  assertEqual(result, [60, 10, 30])
}

export async function testNeverExceedsTheLimit() {
  let active = 0
  let peak = 0
  await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async () => {
    active++
    peak = Math.max(peak, active)
    await sleep(5)
    active--
  })
  assertEqual(peak, 3)
}

export async function testStartsNextAsSoonAsOneFinishes() {
  const started: number[] = []
  await mapLimit([40, 5, 5, 5], 2, async (ms, i) => { started.push(i); await sleep(ms) })
  assertEqual(started, [0, 1, 2, 3])
}

export async function testStopsAfterFailure() {
  const calls: number[] = []
  try {
    await mapLimit([0, 1, 2, 3, 4], 1, async i => {
      calls.push(i)
      if (i === 1) throw new Error('bad item')
      return i
    })
    assert(false, 'expected a rejection')
  } catch (error) {
    assertEqual((error as Error).message, 'bad item')
  }
  await sleep(5)
  assertEqual(calls, [0, 1])
}

export async function testEmptyAndInvalidLimit() {
  assertEqual(await mapLimit([], 2, async x => x), [])
  let threw = false
  try { await mapLimit([1], 0, async x => x) } catch (error) { threw = error instanceof RangeError }
  assert(threw, 'limit 0 should throw a RangeError')
}
