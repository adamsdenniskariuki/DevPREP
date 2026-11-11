import { EventBus } from '../src/index';

export function testUnsubscribingDuringEmitDoesNotSkip() {
  const bus = new EventBus();
  const calls: string[] = [];
  const stop = bus.on('tick', () => {
    calls.push('a');
    stop();
  });
  bus.on('tick', () => calls.push('b'));
  bus.on('tick', () => calls.push('c'));
  assertEqual(bus.emit('tick'), 3);
  assertEqual(calls, ['a', 'b', 'c']);
  bus.emit('tick');
  assertEqual(calls, ['a', 'b', 'c', 'b', 'c']);
}

export function testHandlerAddedDuringEmitWaitsForNextEmit() {
  const bus = new EventBus();
  let late = 0;
  bus.on('tick', () => {
    bus.on('tick', () => late++);
  });
  assertEqual(bus.emit('tick'), 1);
  assertEqual(late, 0);
}

export function testTwoOnceHandlersBothRun() {
  const bus = new EventBus();
  const calls: number[] = [];
  bus.once('go', () => calls.push(1));
  bus.once('go', () => calls.push(2));
  bus.emit('go');
  assertEqual(calls, [1, 2]);
}
