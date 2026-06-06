type cache_entry<T> = {
  value: T
  expires_at: number
}

type in_flight_entry<T> = {
  token: symbol
  promise: Promise<T>
}

type resource_loader<T> = (guild_id: string) => Promise<T>

const DEFAULT_MAX_ENTRIES = 500

export class GuildResourceCache<T> {
  private readonly cache = new Map<string, cache_entry<T>>()
  private readonly in_flight = new Map<string, in_flight_entry<T>>()
  private readonly cache_ttl_ms: number
  private readonly max_entries: number

  constructor(
    private readonly load_resource: resource_loader<T>,
    options: { cache_ttl_ms?: number; max_entries?: number } = {}
  ) {
    this.cache_ttl_ms = Math.max(0, options.cache_ttl_ms ?? 0)
    this.max_entries = Math.max(1, options.max_entries ?? DEFAULT_MAX_ENTRIES)
  }

  clear() {
    this.cache.clear()
    this.in_flight.clear()
  }

  invalidate(guild_id: string) {
    this.cache.delete(guild_id)
    this.in_flight.delete(guild_id)
  }

  async get(guild_id: string): Promise<T> {
    if (this.cache_ttl_ms > 0) {
      const cached = this.cache.get(guild_id)
      if (cached && cached.expires_at > Date.now()) {
        return cached.value
      }
    }

    const existing_load = this.in_flight.get(guild_id)
    if (existing_load) return existing_load.promise

    const token = Symbol(guild_id)
    const promise = this.load_resource(guild_id)
      .then((value) => {
        const current_load = this.in_flight.get(guild_id)
        if (this.cache_ttl_ms > 0 && current_load?.token === token) {
          this.cache.set(guild_id, {
            value,
            expires_at: Date.now() + this.cache_ttl_ms,
          })
          this.prune_cache()
        }
        return value
      })
      .finally(() => {
        if (this.in_flight.get(guild_id)?.token === token) {
          this.in_flight.delete(guild_id)
        }
      })

    this.in_flight.set(guild_id, { token, promise })
    return promise
  }

  private prune_cache() {
    const now = Date.now()

    for (const [guild_id, entry] of this.cache.entries()) {
      if (entry.expires_at <= now) {
        this.cache.delete(guild_id)
      }
    }

    while (this.cache.size > this.max_entries) {
      const first = this.cache.keys().next()
      if (first.done) break
      this.cache.delete(first.value)
    }
  }
}
