export interface NativeSide { startObserving(event: string): void; stopObserving(event: string): void }
export interface Subscription { remove(): void }

export function createEmitter(native: NativeSide) {
  const listeners = new Map<string, Array<(payload: unknown) => void>>()
  return {
    addListener(event: string, fn: (payload: unknown) => void): Subscription {
      const list = listeners.get(event) ?? []
      list.push(fn)
      listeners.set(event, list)
      native.startObserving(event)
      return { remove() { list.splice(list.indexOf(fn), 1) } }
    },
    emit(event: string, payload: unknown) {
      for (const fn of listeners.get(event) ?? []) fn(payload)
    },
    listenerCount(event: string) { return listeners.get(event)?.length ?? 0 },
  }
}
