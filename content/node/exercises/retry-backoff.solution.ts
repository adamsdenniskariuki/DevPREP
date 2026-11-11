export interface RetryOptions {
  retries?: number
  baseMs?: number
  factor?: number
  maxMs?: number
  shouldRetry?: (error: unknown) => boolean
  sleep: (ms: number) => Promise<void>
}

export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries = 3, baseMs = 100, factor = 2, maxMs = Infinity, shouldRetry = () => true, sleep } = options
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      if (attempt > retries || !shouldRetry(error)) throw error
      await sleep(Math.min(maxMs, baseMs * factor ** (attempt - 1)))
    }
  }
}
