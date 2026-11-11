export type Decision = { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number }

export function createLimiter(options: { capacity: number; refillPerSecond: number; now: () => number }) {
  const used = new Map<string, number>()
  // TODO: refill over time and report retryAfterMs.
  return function take(clientId: string): Decision {
    const count = used.get(clientId) ?? 0
    if (count >= options.capacity) return { allowed: false, retryAfterMs: 1000 }
    used.set(clientId, count + 1)
    return { allowed: true, remaining: options.capacity - count - 1 }
  }
}
