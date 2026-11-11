import { retry } from './index'

function flaky(failures: number) {
  let calls = 0
  return async () => {
    calls++
    if (calls <= failures) throw new Error(`fail ${calls}`)
    return 'ok'
  }
}

export async function testSucceedsAfterFailures() {
  const delays: number[] = []
  const value = await retry(flaky(2), { sleep: async ms => { delays.push(ms) } })
  assertEqual(value, 'ok')
  assertEqual(delays, [100, 200])
}

export async function testGivesUpAfterRetries() {
  const delays: number[] = []
  try {
    await retry(flaky(10), { retries: 2, baseMs: 50, sleep: async ms => { delays.push(ms) } })
    assert(false, 'expected a rejection')
  } catch (error) {
    assertEqual((error as Error).message, 'fail 3')
  }
  assertEqual(delays, [50, 100])
}

export async function testCapsTheDelay() {
  const delays: number[] = []
  await retry(flaky(4), { retries: 5, baseMs: 100, factor: 3, maxMs: 500, sleep: async ms => { delays.push(ms) } })
  assertEqual(delays, [100, 300, 500, 500])
}

export async function testDoesNotRetryPermanentErrors() {
  let calls = 0
  try {
    await retry(async () => { calls++; throw Object.assign(new Error('bad request'), { status: 400 }) }, {
      shouldRetry: error => (error as { status?: number }).status !== 400,
      sleep: async () => {},
    })
  } catch (error) {
    assertEqual((error as Error).message, 'bad request')
  }
  assertEqual(calls, 1)
}

export async function testPassesTheAttemptNumber() {
  const seen: number[] = []
  await retry(async attempt => { seen.push(attempt); if (attempt < 3) throw new Error('again'); return attempt }, { sleep: async () => {} })
  assertEqual(seen, [1, 2, 3])
}
