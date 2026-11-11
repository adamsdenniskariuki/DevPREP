export class LruCache<K, V> {
  private map = new Map<K, V>()

  constructor(private maxEntries: number, private ttlMs: number, private now: () => number) {}

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    // TODO: refresh recency and expire old entries.
    return this.map.get(key)
  }

  set(key: K, value: V): void {
    this.map.set(key, value)
    if (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value as K)
  }
}
