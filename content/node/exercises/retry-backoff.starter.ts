export interface RetryOptions {
  retries?: number
  baseMs?: number
  factor?: number
  maxMs?: number
  shouldRetry?: (error: unknown) => boolean
  sleep: (ms: number) => Promise<void>
}

export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  // TODO: retry with backoff instead of trying only once.
  return fn(1)
}
