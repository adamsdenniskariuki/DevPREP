export interface NativeSide { startObserving(event: string): void; stopObserving(event: string): void }
export interface Subscription { remove(): void }

interface Entry { fn: (payload: unknown) => void }

export function createEmitter(native: NativeSide) {
  const listeners = new Map<string, Entry[]>()
  return {
    addListener(event: string, fn: (payload: unknown) => void): Subscription {
      const entry: Entry = { fn }
      const list = listeners.get(event) ?? []
      if (list.length === 0) native.startObserving(event)
      listeners.set(event, [...list, entry])
      let removed = false
      return {
        remove() {
          if (removed) return
          removed = true
          const rest = (listeners.get(event) ?? []).filter(other => other !== entry)
          if (rest.length) listeners.set(event, rest)
          else { listeners.delete(event); native.stopObserving(event) }
        },
      }
    },
    emit(event: string, payload: unknown) {
      for (const entry of listeners.get(event) ?? []) entry.fn(payload)
    },
    listenerCount(event: string) { return listeners.get(event)?.length ?? 0 },
  }
}
