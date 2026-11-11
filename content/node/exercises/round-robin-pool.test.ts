import { WorkerPool } from './index'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function workers(count: number, log: string[], ms = 5) {
  return Array.from({ length: count }, (_, w) => async (job: string) => {
    log.push(`w${w}:${job}`)
    await sleep(ms)
    return `${job} by w${w}`
  })
}

export async function testReturnsResults() {
  const pool = new WorkerPool(workers(2, []))
  assertEqual(await Promise.all([pool.run('a'), pool.run('b')]), ['a by w0', 'b by w1'])
}

export async function testQueuesWhenAllBusy() {
  const log: string[] = []
  const pool = new WorkerPool(workers(2, log))
  const all = Promise.all(['a', 'b', 'c', 'd', 'e'].map(job => pool.run(job)))
  assertEqual(pool.stats(), { busy: 2, queued: 3 })
  await all
  assertEqual(pool.stats(), { busy: 0, queued: 0 })
  assertEqual(log.length, 5)
}

export async function testNeverRunsTwoJobsOnOneWorker() {
  let active = [0, 0]
  let clash = false
  const pool = new WorkerPool([0, 1].map(w => async (ms: number) => {
    active[w]++
    if (active[w] > 1) clash = true
    await sleep(ms)
    active[w]--
    return w
  }))
  await Promise.all([8, 2, 2, 2, 2, 2].map(ms => pool.run(ms)))
  assertEqual(clash, false)
}

export async function testRoundRobinOrder() {
  const log: string[] = []
  const pool = new WorkerPool(workers(3, log, 1))
  for (const job of ['a', 'b', 'c', 'd']) await pool.run(job)
  assertEqual(log, ['w0:a', 'w1:b', 'w2:c', 'w0:d'])
}

export async function testFailureOnlyRejectsItsJob() {
  const pool = new WorkerPool([async (job: number) => { await sleep(1); if (job === 2) throw new Error('job 2 failed'); return job * 10 }])
  const results = await Promise.allSettled([1, 2, 3].map(job => pool.run(job)))
  assertEqual(results.map(r => r.status), ['fulfilled', 'rejected', 'fulfilled'])
  assertEqual(pool.stats(), { busy: 0, queued: 0 })
}
