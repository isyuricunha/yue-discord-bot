function normalize_positive_int(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) return fallback
  return Math.max(1, Math.trunc(value))
}

export class RecentConversationActivity {
  private readonly ttl_ms: number
  private readonly max_entries: number
  private readonly state = new Map<string, number>()

  constructor(input: { ttl_seconds?: number; max_entries?: number } = {}) {
    const ttl_seconds = normalize_positive_int(input.ttl_seconds, 120)
    this.ttl_ms = ttl_seconds * 1000
    this.max_entries = normalize_positive_int(input.max_entries, 5000)
  }

  get_last_activity_ms(key: string, now_ms = Date.now()): number | null {
    const last_activity_ms = this.state.get(key)
    if (last_activity_ms === undefined) return null

    if (now_ms - last_activity_ms > this.ttl_ms) {
      this.state.delete(key)
      return null
    }

    // Promote active keys for LRU eviction without extending their activity TTL.
    this.state.delete(key)
    this.state.set(key, last_activity_ms)
    return last_activity_ms
  }

  touch(key: string, activity_ms = Date.now()): void {
    if (!key) return

    this.state.delete(key)
    this.state.set(key, activity_ms)

    while (this.state.size > this.max_entries) {
      const oldest_key = this.state.keys().next().value as string | undefined
      if (oldest_key === undefined) break
      this.state.delete(oldest_key)
    }
  }

  clear(key: string): void {
    this.state.delete(key)
  }

  get size(): number {
    return this.state.size
  }
}
