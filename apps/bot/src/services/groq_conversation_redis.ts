import { createClient } from 'redis'

import type { conversation_message } from './groq_conversation_store'
import type { groq_conversation_backend } from './groq_conversation_backend'

type redis_conversation_state = {
  messages: conversation_message[]
  last_activity_ms: number
}

function parse_int_env(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function with_timeout<T>(promise: Promise<T>, timeout_ms: number, label: string): Promise<T> {
  if (timeout_ms <= 0) return promise

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeout_ms}ms`))
      }, timeout_ms)
      ;(timer as any).unref?.()
    }),
  ])
}

function now_ms() {
  return Date.now()
}

function normalize_prefix(prefix: string): string {
  const trimmed = prefix.trim()
  return trimmed.endsWith(':') ? trimmed : `${trimmed}:`
}

function normalize_redis_string(value: string | Buffer): string {
  return typeof value === 'string' ? value : value.toString('utf8')
}

export class RedisGroqConversationStore implements groq_conversation_backend {
  private readonly redis_url: string
  private readonly redis_password: string | null
  private readonly key_prefix: string
  private readonly ttl_seconds: number
  private readonly max_messages: number
  private readonly max_message_chars: number
  private client: ReturnType<typeof createClient> | null = null

  constructor(input?: {
    redis_url?: string
    redis_password?: string
    key_prefix?: string
    ttl_seconds?: number
    max_messages?: number
    max_message_chars?: number
  }) {
    const redis_url = input?.redis_url ?? process.env.REDIS_URL
    if (typeof redis_url !== 'string' || redis_url.trim().length === 0) {
      throw new Error('REDIS_URL is required to use RedisGroqConversationStore')
    }

    this.redis_url = redis_url.trim()

    const password_from_env = typeof process.env.REDIS_PASSWORD === 'string' ? process.env.REDIS_PASSWORD.trim() : ''
    const password_from_input = typeof input?.redis_password === 'string' ? input.redis_password.trim() : ''

    let url_has_password = false
    try {
      const parsed = new URL(this.redis_url)
      url_has_password = typeof parsed.password === 'string' && parsed.password.length > 0
    } catch {
      url_has_password = false
    }

    this.redis_password =
      url_has_password
        ? null
        : (password_from_input || password_from_env) ? (password_from_input || password_from_env) : null

    this.key_prefix = normalize_prefix(input?.key_prefix ?? process.env.GROQ_CONTEXT_REDIS_PREFIX ?? 'yue:groq:context')

    this.ttl_seconds = Math.max(60, input?.ttl_seconds ?? parse_int_env(process.env.GROQ_CONTEXT_TTL_SECONDS, 30 * 60))
    this.max_messages = Math.max(2, input?.max_messages ?? parse_int_env(process.env.GROQ_CONTEXT_MAX_MESSAGES, 12))
    this.max_message_chars = Math.max(
      1,
      input?.max_message_chars ?? parse_int_env(process.env.GROQ_CONTEXT_MAX_MESSAGE_CHARS, 700)
    )
  }

  private build_key(key: string): string {
    return `${this.key_prefix}${key}`
  }

  private async get_client() {
    if (this.client) return this.client

    const connect_timeout_ms = Math.max(100, parse_int_env(process.env.REDIS_CONNECT_TIMEOUT_MS, 800))
    const command_timeout_ms = Math.max(100, parse_int_env(process.env.REDIS_COMMAND_TIMEOUT_MS, 800))

    const client = createClient({
      url: this.redis_url,
      ...(this.redis_password ? { password: this.redis_password } : {}),
      socket: {
        connectTimeout: connect_timeout_ms,
        reconnectStrategy: () => new Error('Redis reconnect disabled for Groq conversation store'),
      },
      disableOfflineQueue: true,
    })
    client.on('error', () => {})

    try {
      await with_timeout(client.connect(), connect_timeout_ms, 'Redis connect')
    } catch (error) {
      await client.disconnect().catch(() => undefined)
      throw error
    }

    this.client = client
    ;(this.client as any).__command_timeout_ms = command_timeout_ms
    return client
  }

  private normalize_message(message: conversation_message): conversation_message {
    const trimmed = message.content.trim()
    const content = trimmed.length > this.max_message_chars ? `${trimmed.slice(0, this.max_message_chars)}…` : trimmed

    return {
      role: message.role,
      content,
    }
  }

  async get_history(key: string): Promise<conversation_message[]> {
    const client = await this.get_client()
    const command_timeout_ms = Number((client as any).__command_timeout_ms) || 0
    const raw = await with_timeout(client.get(this.build_key(key)), command_timeout_ms, 'Redis GET')
    if (!raw) return []

    try {
      const parsed = JSON.parse(normalize_redis_string(raw)) as redis_conversation_state
      if (!parsed || typeof parsed !== 'object') return []
      if (!Array.isArray(parsed.messages)) return []

      return parsed.messages
        .filter((m): m is conversation_message =>
          Boolean(m) && (m as any).role && typeof (m as any).content === 'string'
        )
        .slice(-this.max_messages)
    } catch {
      return []
    }
  }

  async get_last_activity_ms(key: string): Promise<number | null> {
    const client = await this.get_client()
    const command_timeout_ms = Number((client as any).__command_timeout_ms) || 0
    const raw = await with_timeout(client.get(this.build_key(key)), command_timeout_ms, 'Redis GET')
    if (!raw) return null

    try {
      const parsed = JSON.parse(normalize_redis_string(raw)) as redis_conversation_state
      const value = (parsed as any)?.last_activity_ms
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    } catch {
      return null
    }
  }

  async append(key: string, message: conversation_message): Promise<void> {
    const client = await this.get_client()
    const redis_key = this.build_key(key)

    const current = await this.get_history(key)
    const next_messages = current.concat([this.normalize_message(message)]).slice(-this.max_messages)

    const payload: redis_conversation_state = {
      messages: next_messages,
      last_activity_ms: now_ms(),
    }

    const command_timeout_ms = Number((client as any).__command_timeout_ms) || 0
    await with_timeout(client.set(redis_key, JSON.stringify(payload), { EX: this.ttl_seconds }), command_timeout_ms, 'Redis SET')
  }

  async clear(key: string): Promise<void> {
    const client = await this.get_client()
    const command_timeout_ms = Number((client as any).__command_timeout_ms) || 0
    await with_timeout(client.del(this.build_key(key)), command_timeout_ms, 'Redis DEL')
  }
}
