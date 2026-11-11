interface Entry<V> { value: V; at: number }

export class LruCache<K, V> {
  private map = new Map<K, Entry<V>>()

  constructor(private maxEntries: number, private ttlMs: number, private now: () => number) {}

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    this.map.delete(key)
    if (this.now() - entry.at > this.ttlMs) return undefined
    this.map.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    this.map.delete(key)
    this.map.set(key, { value, at: this.now() })
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value as K)
  }
}
