export type rate_limiter_options = {
  windowMs: number
  max: number
}

type rate_limiter_entry = {
  count: number
  resetAt: number
}

export class RateLimiter {
  private readonly windowMs: number
  private readonly max: number
  private readonly entries = new Map<string, rate_limiter_entry>()

  constructor(options: rate_limiter_options) {
    this.windowMs = options.windowMs
    this.max = options.max
  }

  tryConsume(key: string, now = Date.now()): { allowed: true; remaining: number; resetAt: number } | { allowed: false; remaining: number; resetAt: number } {
    const existing = this.entries.get(key)

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs
      const entry: rate_limiter_entry = { count: 1, resetAt }
      this.entries.set(key, entry)
      return { allowed: true, remaining: this.max - 1, resetAt }
    }

    if (existing.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt }
    }

    existing.count += 1
    this.entries.set(key, existing)
    return { allowed: true, remaining: this.max - existing.count, resetAt: existing.resetAt }
  }

  clear(key: string) {
    this.entries.delete(key)
  }

  prune(now = Date.now()) {
    for (const [key, entry] of this.entries.entries()) {
      if (now >= entry.resetAt) this.entries.delete(key)
    }
  }
}
