import { EventBus } from '../src/index';

export function testOnAnyRunsAfterSpecificHandlers() {
  const bus = new EventBus();
  const calls: string[] = [];
  bus.onAny((event, payload) => calls.push(`any:${event}:${String(payload)}`));
  bus.on('save', (payload) => calls.push(`save:${String(payload)}`));
  assertEqual(bus.emit('save', 7), 2);
  assertEqual(calls, ['save:7', 'any:save:7']);
}

export function testOnAnyWithNoSpecificHandlers() {
  const bus = new EventBus();
  let hits = 0;
  bus.onAny(() => hits++);
  assertEqual(bus.emit('nobody-listens'), 1);
  assertEqual(hits, 1);
}

export function testOnAnyUnsubscribe() {
  const bus = new EventBus();
  let hits = 0;
  const stop = bus.onAny(() => hits++);
  bus.emit('a');
  stop();
  bus.emit('a');
  assertEqual(hits, 1);
}

export function testCountIgnoresWildcards() {
  const bus = new EventBus();
  bus.onAny(() => undefined);
  assertEqual(bus.count('save'), 0);
}
