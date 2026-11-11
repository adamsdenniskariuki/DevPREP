export type Memoized<A extends unknown[], R> = ((...args: A) => Promise<R>) & { clear(): void }

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: (...args: A) => string = (...args) => JSON.stringify(args)): Memoized<A, R> {
  const cache = new Map<string, R>()
  // TODO: share in-flight promises and forget failures.
  const memo = async (...args: A) => {
    const k = key(...args)
    if (cache.has(k)) return cache.get(k)!
    const value = await fn(...args)
    cache.set(k, value)
    return value
  }
  return Object.assign(memo, { clear: () => cache.clear() })
}
