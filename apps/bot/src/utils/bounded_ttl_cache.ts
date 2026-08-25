export type bounded_ttl_cache_options = {
  ttl_ms: number
  max_entries: number
}

type cache_entry<V> = {
  value: V
  expires_at_ms: number
}

export class BoundedTtlCache<K, V> {
  private readonly entries = new Map<K, cache_entry<V>>()
  private readonly ttl_ms: number
  private readonly max_entries: number

  constructor(options: bounded_ttl_cache_options) {
    this.ttl_ms = Math.max(0, options.ttl_ms)
    this.max_entries = Math.max(1, options.max_entries)
  }

  get(key: K, now_ms = Date.now()): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    if (entry.expires_at_ms <= now_ms) {
      this.entries.delete(key)
      return undefined
    }

    // Refresh insertion order so bounded eviction behaves like a tiny LRU.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: K, value: V, now_ms = Date.now()): void {
    this.entries.delete(key)
    this.entries.set(key, {
      value,
      expires_at_ms: now_ms + this.ttl_ms,
    })
    this.prune(now_ms)
  }

  delete(key: K): boolean {
    return this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }

  prune(now_ms = Date.now()): void {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expires_at_ms <= now_ms) this.entries.delete(key)
    }

    while (this.entries.size > this.max_entries) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  get size(): number {
    return this.entries.size
  }
}
