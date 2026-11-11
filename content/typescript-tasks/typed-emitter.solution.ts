export type Listener<T> = (payload: T) => void

export interface Emitter<Events> {
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void
  emit<K extends keyof Events>(event: K, payload: Events[K]): number
  listenerCount(event: keyof Events): number
}

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
  const table: { [K in keyof Events]?: Array<Listener<Events[K]>> } = {}
  return {
    on(event, listener) {
      const list = (table[event] ??= [])
      list.push(listener)
      return () => {
        const index = list.indexOf(listener)
        if (index >= 0) list.splice(index, 1)
      }
    },
    emit(event, payload) {
      const list = [...(table[event] ?? [])]
      for (const listener of list) listener(payload)
      return list.length
    },
    listenerCount: event => table[event]?.length ?? 0,
  }
}
