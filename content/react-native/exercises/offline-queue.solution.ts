export interface Mutation { id: string; [key: string]: unknown }
export interface QueueOptions { send(mutation: Mutation): Promise<void>; maxAttempts: number; baseDelay: number }

interface Entry { mutation: Mutation; attempts: number; nextAttemptAt: number }

export function createOfflineQueue({ send, maxAttempts, baseDelay }: QueueOptions) {
  const queue: Entry[] = []
  const dead: Entry[] = []
  let online = true
  let running: Promise<void> | undefined

  async function run(now: number) {
    while (online && queue.length) {
      const head = queue[0]
      if (head.nextAttemptAt > now) return
      try {
        await send(head.mutation)
        queue.shift()
      } catch {
        head.attempts++
        if (head.attempts >= maxAttempts) { dead.push(queue.shift()!); continue }
        head.nextAttemptAt = now + baseDelay * 2 ** (head.attempts - 1)
        return
      }
    }
  }

  const find = (id: string) => queue.find(e => e.mutation.id === id) ?? dead.find(e => e.mutation.id === id)

  return {
    enqueue(mutation: Mutation) {
      if (queue.some(e => e.mutation.id === mutation.id)) return
      queue.push({ mutation, attempts: 0, nextAttemptAt: 0 })
    },
    setOnline(value: boolean) { online = value },
    flush(now: number): Promise<void> {
      running ??= run(now).finally(() => { running = undefined })
      return running
    },
    pending(): string[] { return queue.map(e => e.mutation.id) },
    failed(): string[] { return dead.map(e => e.mutation.id) },
    attempts(id: string): number { return find(id)?.attempts ?? 0 },
  }
}
