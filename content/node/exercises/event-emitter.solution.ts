type Fn = (...args: any[]) => void
interface Listener { fn: Fn; once: boolean }

export class Emitter {
  private listeners = new Map<string, Listener[]>()

  private add(event: string, fn: Fn, once: boolean): this {
    const list = this.listeners.get(event) ?? []
    list.push({ fn, once })
    this.listeners.set(event, list)
    return this
  }

  on(event: string, fn: Fn): this {
    return this.add(event, fn, false)
  }

  once(event: string, fn: Fn): this {
    return this.add(event, fn, true)
  }

  off(event: string, fn: Fn): this {
    const list = this.listeners.get(event)
    if (!list) return this
    const at = list.findIndex(l => l.fn === fn)
    if (at >= 0) list.splice(at, 1)
    if (!list.length) this.listeners.delete(event)
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this.listeners.get(event)
    if (!list || !list.length) {
      if (event === 'error') throw args[0] instanceof Error ? args[0] : new Error('Unhandled error')
      return false
    }
    for (const listener of [...list]) {
      if (listener.once) {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
      listener.fn.apply(this, args)
    }
    return true
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0
  }
}
