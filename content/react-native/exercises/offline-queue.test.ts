import { createOfflineQueue } from './index'

function server(failures: Record<string, number> = {}) {
  const sent: string[] = []
  return {
    sent,
    async send(m: { id: string }) {
      sent.push(m.id)
      await Promise.resolve()
      if ((failures[m.id] ?? 0) > 0) { failures[m.id]--; throw new Error('offline') }
    },
  }
}

export async function testSendsInOrderOneAtATime() {
  let inFlight = 0, maxInFlight = 0
  const sent: string[] = []
  const queue = createOfflineQueue({
    async send(m) { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); sent.push(m.id); await new Promise(r => setTimeout(r, 1)); inFlight-- },
    maxAttempts: 3, baseDelay: 100,
  })
  queue.enqueue({ id: 'a' }); queue.enqueue({ id: 'b' }); queue.enqueue({ id: 'a' }); queue.enqueue({ id: 'c' })
  await queue.flush(0)
  assertEqual(sent, ['a', 'b', 'c'])
  assertEqual(maxInFlight, 1)
  assertEqual(queue.pending(), [])
}

export async function testFailureStopsAndBacksOff() {
  const s = server({ b: 1 })
  const queue = createOfflineQueue({ send: s.send, maxAttempts: 3, baseDelay: 100 })
  for (const id of ['a', 'b', 'c']) queue.enqueue({ id })
  await queue.flush(1000)
  assertEqual(s.sent, ['a', 'b'])
  assertEqual(queue.pending(), ['b', 'c'])
  assertEqual(queue.attempts('b'), 1)
  await queue.flush(1050)
  assertEqual(s.sent, ['a', 'b'], 'still backing off')
  await queue.flush(1100)
  assertEqual(s.sent, ['a', 'b', 'b', 'c'])
  assertEqual(queue.pending(), [])
}

export async function testBackoffDoubles() {
  const s = server({ x: 5 })
  const queue = createOfflineQueue({ send: s.send, maxAttempts: 5, baseDelay: 10 })
  queue.enqueue({ id: 'x' })
  await queue.flush(0)
  await queue.flush(10)
  await queue.flush(29)
  assertEqual(s.sent.length, 2, 'second retry waits 20 after the failure at 10')
  await queue.flush(30)
  assertEqual(s.sent.length, 3)
}

export async function testGivesUpAfterMaxAttempts() {
  const s = server({ bad: 99 })
  const queue = createOfflineQueue({ send: s.send, maxAttempts: 2, baseDelay: 1 })
  queue.enqueue({ id: 'bad' }); queue.enqueue({ id: 'ok' })
  await queue.flush(0)
  await queue.flush(10)
  assertEqual(queue.failed(), ['bad'])
  assertEqual(queue.attempts('bad'), 2)
  assertEqual(queue.pending(), [])
  assertEqual(s.sent, ['bad', 'bad', 'ok'])
}

export async function testOfflineAndConcurrentFlush() {
  const s = server()
  const queue = createOfflineQueue({ send: s.send, maxAttempts: 3, baseDelay: 1 })
  queue.enqueue({ id: 'a' })
  queue.setOnline(false)
  await queue.flush(0)
  assertEqual(s.sent, [])
  queue.setOnline(true)
  const first = queue.flush(0)
  const second = queue.flush(0)
  assert(first === second, 'a running flush is shared')
  await first
  assertEqual(s.sent, ['a'])
}
