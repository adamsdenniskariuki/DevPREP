export interface Mutation { id: string; [key: string]: unknown }
export interface QueueOptions { send(mutation: Mutation): Promise<void>; maxAttempts: number; baseDelay: number }

export function createOfflineQueue(options: QueueOptions) {
  const queue: Mutation[] = []
  let online = true
  return {
    enqueue(mutation: Mutation) { queue.push(mutation) },
    setOnline(value: boolean) { online = value },
    async flush(now: number): Promise<void> {
      // TODO: order, retries, backoff, failed items and concurrent flushes
      await Promise.all(queue.map(m => options.send(m)))
      queue.length = 0
    },
    pending(): string[] { return queue.map(m => m.id) },
    failed(): string[] { return [] },
    attempts(id: string): number { return 0 },
  }
}
