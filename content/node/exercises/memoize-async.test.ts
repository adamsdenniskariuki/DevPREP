import { memoizeAsync } from './index'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function testCachesResults() {
  let calls = 0
  const square = memoizeAsync(async (n: number) => { calls++; return n * n })
  assertEqual(await square(4), 16)
  assertEqual(await square(4), 16)
  assertEqual(await square(5), 25)
  assertEqual(calls, 2)
}

export async function testSharesInFlightCalls() {
  let calls = 0
  const load = memoizeAsync(async (id: string) => { calls++; await sleep(5); return `user ${id}` })
  const results = await Promise.all([load('1'), load('1'), load('1')])
  assertEqual(results, ['user 1', 'user 1', 'user 1'])
  assertEqual(calls, 1)
}

export async function testDoesNotCacheFailures() {
  let calls = 0
  const flaky = memoizeAsync(async () => { calls++; if (calls === 1) throw new Error('timeout'); return 'ok' })
  try { await flaky(); assert(false, 'expected a rejection') } catch (error) { assertEqual((error as Error).message, 'timeout') }
  assertEqual(await flaky(), 'ok')
  assertEqual(calls, 2)
}

export async function testCustomKeyAndClear() {
  let calls = 0
  const byId = memoizeAsync(async (user: { id: number; name: string }) => { calls++; return user.id }, user => String(user.id))
  await byId({ id: 1, name: 'a' })
  await byId({ id: 1, name: 'b' })
  assertEqual(calls, 1)
  byId.clear()
  await byId({ id: 1, name: 'a' })
  assertEqual(calls, 2)
}
