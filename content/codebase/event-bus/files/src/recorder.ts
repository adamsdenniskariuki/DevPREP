import type { EventBus } from './bus';

/** Records every payload emitted for the given events, in order. */
export function record(bus: EventBus, events: string[]): Array<[string, unknown]> {
  const seen: Array<[string, unknown]> = [];
  for (const event of events) bus.on(event, (payload) => seen.push([event, payload]));
  return seen;
}
