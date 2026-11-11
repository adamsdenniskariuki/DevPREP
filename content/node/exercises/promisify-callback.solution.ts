export type Callback<T> = (err: unknown, value?: T) => void

export function promisify<A extends unknown[], T>(fn: (...args: [...A, Callback<T>]) => void): (...args: A) => Promise<T> {
  return (...args: A) => new Promise<T>((resolve, reject) => {
    try {
      fn(...args, (err, value) => {
        if (err !== null && err !== undefined) reject(err)
        else resolve(value as T)
      })
    } catch (error) {
      reject(error)
    }
  })
}
