import Redis from 'ioredis'

import { ConversationStore, type conversation_store_options } from './conversation_store'
import type { panel_ai_message } from './panel_ai'

const NAMESPACE = 'panel-ai:conv:'
const REDIS_OPERATION_TIMEOUT_MS = 5_000

type redis_like = {
  keys(pattern: string): Promise<string[]>
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
}

type store_logger = {
  info: (object: Record<string, unknown>) => void
  warn: (object: Record<string, unknown>) => void
}

const noop_logger: store_logger = {
  info: () => undefined,
  warn: () => undefined,
}

type stored_payload = {
  version: number
  messages: panel_ai_message[]
}

export type persistent_conversation_store_options = conversation_store_options & {
  maxEntries?: number
  log?: store_logger
}

/**
 * Conversation store with Redis write-through persistence.
 *
 * The synchronous get/set contract of ConversationStore is preserved on
 * purpose: panel AI routes and their tests consume it synchronously. Writes
 * go to the in-memory store (authoritative for this process) and are mirrored
 * to Redis with the same TTL, so a container restart or redeploy hydrates the
 * conversations back on boot instead of losing them (panel AI improvement #5).
 */
export class PersistentConversationStore {
  private readonly memory: ConversationStore
  private readonly redis: redis_like
  private readonly ttlSeconds: number
  private readonly maxEntries: number
  private readonly log: store_logger
  private hydrated = false

  constructor(redis: redis_like, options: persistent_conversation_store_options = {}) {
    this.memory = new ConversationStore(options)
    this.redis = redis
    this.log = options.log ?? noop_logger
    this.ttlSeconds = Math.ceil((options.ttlMs ?? 30 * 60 * 1000) / 1000)
    this.maxEntries = options.maxEntries ?? 5_000
  }

  /** Loads persisted conversations into memory. Safe to call more than once. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return

    try {
      const keys = await this.with_timeout(this.redis.keys(`${NAMESPACE}*`))
      if (keys.length === 0) {
        this.hydrated = true
        return
      }

      for (const redis_key of keys.slice(0, this.maxEntries)) {
        const raw = await this.with_timeout(this.redis.get(redis_key))
        if (!raw) continue

        try {
          const payload = JSON.parse(raw) as stored_payload
          const key = redis_key.slice(NAMESPACE.length)
          this.memory.set(key, payload.version, payload.messages)
        } catch {
          this.log.warn({ redisKey: redis_key, message: 'Skipping unreadable persisted panel AI conversation' })
        }
      }

      this.hydrated = true
      this.log.info({ count: keys.length })
    } catch (error) {
      this.log.warn({ err: error })
    }
  }

  get(key: string, version: number): panel_ai_message[] {
    return this.memory.get(key, version)
  }

  set(key: string, version: number, messages: panel_ai_message[]): void {
    this.memory.set(key, version, messages)

    const payload: stored_payload = { version, messages }
    void Promise.resolve(
      this.redis.set(`${NAMESPACE}${key}`, JSON.stringify(payload), 'EX', this.ttlSeconds),
    ).catch((error: unknown) => {
      this.log.warn({ err: error })
    })
  }

  delete(key: string): void {
    this.memory.delete(key)
  }

  clear(): void {
    this.memory.clear()
  }

  private with_timeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('redis timeout')), REDIS_OPERATION_TIMEOUT_MS)
        if (typeof timer === 'object' && 'unref' in timer) (timer as { unref(): void }).unref()
      }),
    ])
  }
}

/**
 * Production factory: with REDIS_URL configured the panel AI conversations
 * survive restarts and redeploys; without it the previous in-memory behavior
 * is kept.
 */
export function create_runtime_conversation_store(
  options: persistent_conversation_store_options & { redisUrl?: string; RedisClient?: typeof Redis } = {},
): ConversationStore {
  const redis_url = options.redisUrl ?? process.env.REDIS_URL
  if (!redis_url) return new ConversationStore(options)

  const RedisClient = options.RedisClient ?? Redis
  const client = new RedisClient(redis_url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  })

  const store = new PersistentConversationStore(client as unknown as redis_like, options)
  client
    .connect()
    .then(() => store.hydrate())
    .catch(() => {
      // Redis unavailable: the in-memory store still serves this process.
    })

  return store as unknown as ConversationStore
}
