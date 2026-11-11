import { compose } from './index'

interface Ctx { log: string[]; status?: number }

export async function testRunsInOnionOrder() {
  const ctx: Ctx = { log: [] }
  await compose<Ctx>([
    async (c, next) => { c.log.push('a in'); await next(); c.log.push('a out') },
    async (c, next) => { c.log.push('b in'); await next(); c.log.push('b out') },
    c => { c.log.push('handler') },
  ])(ctx)
  assertEqual(ctx.log, ['a in', 'b in', 'handler', 'b out', 'a out'])
}

export async function testStopsWhenNextIsNotCalled() {
  const ctx: Ctx = { log: [] }
  await compose<Ctx>([
    c => { c.status = 401 },
    c => { c.log.push('should not run') },
  ])(ctx)
  assertEqual(ctx, { log: [], status: 401 })
}

export async function testErrorsCanBeCaughtUpstream() {
  const ctx: Ctx = { log: [] }
  await compose<Ctx>([
    async (c, next) => { try { await next() } catch (error) { c.status = 500; c.log.push((error as Error).message) } },
    () => { throw new Error('boom') },
  ])(ctx)
  assertEqual(ctx, { log: ['boom'], status: 500 })
}

export async function testUncaughtErrorsReject() {
  try {
    await compose<Ctx>([async () => { throw new Error('nope') }])({ log: [] })
    assert(false, 'expected a rejection')
  } catch (error) {
    assertEqual((error as Error).message, 'nope')
  }
}

export async function testNextTwiceRejects() {
  try {
    await compose<Ctx>([async (_c, next) => { await next(); await next() }])({ log: [] })
    assert(false, 'expected a rejection')
  } catch (error) {
    assert(String((error as Error).message).includes('next() called multiple times'))
  }
}

export async function testEmptyChainResolves() {
  await compose<Ctx>([])({ log: [] })
}
