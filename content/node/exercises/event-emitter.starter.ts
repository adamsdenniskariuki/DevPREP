type Fn = (...args: any[]) => void

export class Emitter {
  private listeners = new Map<string, Fn[]>()

  on(event: string, fn: Fn): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn])
    return this
  }

  once(event: string, fn: Fn): this {
    // TODO: run only once.
    return this.on(event, fn)
  }

  off(event: string, fn: Fn): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter(l => l !== fn))
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this.listeners.get(event) ?? []
    for (const fn of list) fn.apply(this, args)
    return list.length > 0
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0
  }
}
