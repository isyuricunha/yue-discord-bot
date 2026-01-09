export type conversation_message = {
  role: 'user' | 'assistant'
  content: string
}

type conversation_state = {
  messages: conversation_message[]
  last_activity_ms: number
  expires_at_ms: number
}

function parse_int_env(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function now_ms() {
  return Date.now()
}

function normalize_content(input: string, max_chars: number): string {
  const trimmed = input.trim()
  if (trimmed.length <= max_chars) return trimmed
  return `${trimmed.slice(0, max_chars)}…`
}

export class GroqConversationStore {
  private readonly ttl_ms: number
  private readonly max_messages: number
  private readonly max_message_chars: number
  private readonly state = new Map<string, conversation_state>()

  constructor(input: { ttl_seconds?: number; max_messages?: number; max_message_chars?: number } = {}) {
    const ttl_seconds = input.ttl_seconds ?? parse_int_env(process.env.GROQ_CONTEXT_TTL_SECONDS, 30 * 60)
    const max_messages = input.max_messages ?? parse_int_env(process.env.GROQ_CONTEXT_MAX_MESSAGES, 12)
    const max_message_chars = input.max_message_chars ?? parse_int_env(process.env.GROQ_CONTEXT_MAX_MESSAGE_CHARS, 700)

    this.ttl_ms = Math.max(60, ttl_seconds) * 1000
    this.max_messages = Math.max(2, max_messages)
    this.max_message_chars = Math.max(1, max_message_chars)
  }

  async get_history(key: string): Promise<conversation_message[]> {
    const st = this.state.get(key)
    if (!st) return []

    const now = now_ms()
    if (st.expires_at_ms <= now) {
      this.state.delete(key)
      return []
    }

    return st.messages.slice()
  }

  async get_last_activity_ms(key: string): Promise<number | null> {
    const st = this.state.get(key)
    if (!st) return null

    const now = now_ms()
    if (st.expires_at_ms <= now) {
      this.state.delete(key)
      return null
    }

    return st.last_activity_ms
  }

  async append(key: string, message: conversation_message): Promise<void> {
    const now = now_ms()
    const expires_at_ms = now + this.ttl_ms

    const normalized: conversation_message = {
      role: message.role,
      content: normalize_content(message.content, this.max_message_chars),
    }

    const existing = this.state.get(key)
    const next_messages = (existing?.messages ?? []).concat([normalized]).slice(-this.max_messages)

    this.state.set(key, { messages: next_messages, last_activity_ms: now, expires_at_ms })
  }

  async clear(key: string): Promise<void> {
    this.state.delete(key)
  }
}

export const groq_conversation_store = new GroqConversationStore()
