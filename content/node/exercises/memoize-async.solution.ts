export type Memoized<A extends unknown[], R> = ((...args: A) => Promise<R>) & { clear(): void }

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: (...args: A) => string = (...args) => JSON.stringify(args)): Memoized<A, R> {
  const cache = new Map<string, Promise<R>>()
  const memo = (...args: A): Promise<R> => {
    const k = key(...args)
    const cached = cache.get(k)
    if (cached) return cached
    const promise = Promise.resolve().then(() => fn(...args))
    cache.set(k, promise)
    promise.catch(() => { if (cache.get(k) === promise) cache.delete(k) })
    return promise
  }
  return Object.assign(memo, { clear: () => cache.clear() })
}
