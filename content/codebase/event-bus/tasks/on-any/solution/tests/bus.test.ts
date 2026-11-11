import { EventBus, record } from '../src/index';

export function testHandlersRunInOrder() {
  const bus = new EventBus();
  const calls: string[] = [];
  bus.on('save', () => calls.push('a'));
  bus.on('save', () => calls.push('b'));
  assertEqual(bus.emit('save'), 2);
  assertEqual(calls, ['a', 'b']);
}

export function testUnsubscribe() {
  const bus = new EventBus();
  const seen = record(bus, ['save']);
  const stop = bus.on('save', () => seen.push(['extra', null]));
  stop();
  bus.emit('save', 1);
  assertEqual(seen, [['save', 1]]);
}

export function testOnceRunsOnce() {
  const bus = new EventBus();
  let calls = 0;
  bus.once('ready', () => calls++);
  bus.emit('ready');
  bus.emit('ready');
  assertEqual(calls, 1);
  assertEqual(bus.count('ready'), 0);
}

export function testOnAnySeesEveryEvent() {
  const bus = new EventBus();
  const seen: string[] = [];
  bus.onAny((event) => seen.push(event));
  bus.emit('save');
  bus.emit('load');
  assertEqual(seen, ['save', 'load']);
}
