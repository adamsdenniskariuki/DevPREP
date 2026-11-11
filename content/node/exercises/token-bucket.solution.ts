export type Decision = { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number }

export function createLimiter(options: { capacity: number; refillPerSecond: number; now: () => number }) {
  const { capacity, refillPerSecond, now } = options
  const buckets = new Map<string, { tokens: number; at: number }>()
  return function take(clientId: string): Decision {
    const t = now()
    const bucket = buckets.get(clientId) ?? { tokens: capacity, at: t }
    bucket.tokens = Math.min(capacity, bucket.tokens + ((t - bucket.at) / 1000) * refillPerSecond)
    bucket.at = t
    buckets.set(clientId, bucket)
    if (bucket.tokens < 1) return { allowed: false, retryAfterMs: Math.ceil(((1 - bucket.tokens) / refillPerSecond) * 1000) }
    bucket.tokens -= 1
    return { allowed: true, remaining: Math.floor(bucket.tokens) }
  }
}
