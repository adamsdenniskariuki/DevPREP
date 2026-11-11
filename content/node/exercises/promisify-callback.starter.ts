export type Callback<T> = (err: unknown, value?: T) => void

export function promisify<A extends unknown[], T>(fn: (...args: [...A, Callback<T>]) => void): (...args: A) => Promise<T> {
  return (...args: A) => new Promise<T>(resolve => {
    // TODO: reject on errors.
    fn(...args, (_err, value) => resolve(value as T))
  })
}
