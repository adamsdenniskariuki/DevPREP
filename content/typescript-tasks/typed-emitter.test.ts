import { createEmitter } from './index'

type AppEvents = { login: { user: string }; logout: undefined; tick: number }

export function testDeliversThePayloadInOrder() {
  const bus = createEmitter<AppEvents>()
  const seen: string[] = []
  bus.on('login', payload => { seen.push(`a:${payload.user}`) })
  bus.on('login', payload => { seen.push(`b:${payload.user}`) })
  assertEqual(bus.emit('login', { user: 'ana' }), 2)
  assertEqual(seen, ['a:ana', 'b:ana'])
}

export function testUnsubscribeRemovesOnlyThatListener() {
  const bus = createEmitter<AppEvents>()
  const seen: number[] = []
  const stop = bus.on('tick', n => { seen.push(n) })
  bus.on('tick', n => { seen.push(n * 10) })
  stop()
  stop()
  assertEqual(bus.emit('tick', 2), 1)
  assertEqual(seen, [20])
  assertEqual(bus.listenerCount('tick'), 1)
}

export function testEventsWithoutListeners() {
  const bus = createEmitter<AppEvents>()
  assertEqual(bus.emit('logout', undefined), 0)
  assertEqual(bus.listenerCount('login'), 0)
}

export function testListenerAddedDuringEmitWaitsForTheNextEmit() {
  const bus = createEmitter<AppEvents>()
  let late = 0
  bus.on('tick', () => { bus.on('tick', () => { late += 1 }) })
  assertEqual(bus.emit('tick', 1), 1)
  assertEqual(late, 0)
}

export function testTheTypesRejectUnknownEventsAndWrongPayloads() {
  const bus = createEmitter<AppEvents>()
  // @ts-expect-error "signup" is not an event
  bus.on('signup', () => {})
  // @ts-expect-error a tick carries a number
  bus.emit('tick', 'soon')
  bus.on('login', payload => {
    // @ts-expect-error a login payload has no id
    void payload.id
  })
  assertEqual(bus.listenerCount('login'), 1)
}
