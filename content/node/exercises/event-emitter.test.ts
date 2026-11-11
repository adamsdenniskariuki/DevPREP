import { Emitter } from './index'

export function testCallsListenersInOrderWithArgs() {
  const e = new Emitter()
  const seen: string[] = []
  e.on('job', (id: string) => seen.push(`a:${id}`)).on('job', (id: string) => seen.push(`b:${id}`))
  assertEqual(e.emit('job', '7'), true)
  assertEqual(seen, ['a:7', 'b:7'])
  assertEqual(e.emit('other'), false)
}

export function testOnceRunsOnce() {
  const e = new Emitter()
  let count = 0
  e.once('ready', () => count++)
  e.emit('ready')
  e.emit('ready')
  assertEqual(count, 1)
  assertEqual(e.listenerCount('ready'), 0)
}

export function testOffRemovesOnceListeners() {
  const e = new Emitter()
  let count = 0
  const fn = () => count++
  e.once('x', fn)
  e.off('x', fn)
  e.emit('x')
  assertEqual(count, 0)
}

export function testRemovalDuringEmitAffectsOnlyLaterEmits() {
  const e = new Emitter()
  const seen: string[] = []
  const second = () => seen.push('second')
  e.on('x', () => { seen.push('first'); e.off('x', second) })
  e.on('x', second)
  e.emit('x')
  e.emit('x')
  assertEqual(seen, ['first', 'second', 'first'])
}

export function testErrorWithoutListenerThrows() {
  const e = new Emitter()
  assertThrows(() => e.emit('error', new Error('disk full')), 'disk full')
  assertThrows(() => e.emit('error', 'nope'), 'Unhandled error')
  let caught: unknown
  e.on('error', (err: Error) => { caught = err.message })
  e.emit('error', new Error('handled'))
  assertEqual(caught, 'handled')
}

export function testThisIsTheEmitter() {
  const e = new Emitter()
  let self: unknown
  e.on('x', function (this: unknown) { self = this })
  e.emit('x')
  assert(self === e, 'listener this should be the emitter')
}
