// TODO: make event names and payloads type-safe (no string or any), then implement the emitter.
export interface Emitter<Events> {
  on(event: string, listener: (payload: any) => void): () => void
  emit(event: string, payload: any): number
  listenerCount(event: string): number
}

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
  return {
    on: () => () => {},
    emit: () => 0,
    listenerCount: () => 0,
  }
}
