import { createEmitter } from './index'

function setup() {
  const calls: string[] = []
  const emitter = createEmitter({ startObserving: e => calls.push(`start:${e}`), stopObserving: e => calls.push(`stop:${e}`) })
  return { calls, emitter }
}

export function testStartsAndStopsOnce() {
  const { calls, emitter } = setup()
  const a = emitter.addListener('battery', () => {})
  const b = emitter.addListener('battery', () => {})
  assertEqual(calls, ['start:battery'])
  a.remove()
  assertEqual(calls, ['start:battery'])
  b.remove()
  assertEqual(calls, ['start:battery', 'stop:battery'])
  assertEqual(emitter.listenerCount('battery'), 0)
}

export function testRemoveIsIdempotent() {
  const { calls, emitter } = setup()
  const fn = () => {}
  const a = emitter.addListener('x', fn)
  const b = emitter.addListener('x', fn)
  a.remove(); a.remove()
  assertEqual(emitter.listenerCount('x'), 1)
  b.remove()
  assertEqual(calls, ['start:x', 'stop:x'])
}

export function testEmitsInOrder() {
  const { emitter } = setup()
  const seen: string[] = []
  emitter.addListener('level', p => seen.push(`a${p}`))
  emitter.addListener('level', p => seen.push(`b${p}`))
  emitter.addListener('other', () => seen.push('wrong'))
  emitter.emit('level', 5)
  assertEqual(seen, ['a5', 'b5'])
}

export function testRemoveDuringEmit() {
  const { emitter } = setup()
  const seen: string[] = []
  const first = emitter.addListener('e', () => { seen.push('first'); second.remove() })
  const second = emitter.addListener('e', () => seen.push('second'))
  emitter.emit('e', null)
  emitter.emit('e', null)
  assertEqual(seen, ['first', 'second', 'first'])
  first.remove()
}
