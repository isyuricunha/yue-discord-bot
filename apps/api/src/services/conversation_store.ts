import type { panel_ai_message } from './panel_ai'

export const DEFAULT_TTL_MS = 30 * 60 * 1000
export const DEFAULT_MAX_HISTORY_MESSAGES = 12
const DEFAULT_MAX_ENTRIES = 5_000

type conversation_entry = {
  version: number
  messages: panel_ai_message[]
  expiresAt: number
}

export type conversation_store_options = {
  ttlMs?: number
  maxHistoryMessages?: number
  maxEntries?: number
}

/**
 * In-memory conversation store for panel AI sessions.
 *
 * Responsibilities:
 * - Enforce TTL: expired entries are lazily removed on access and proactively
 *   pruned on every mutation.
 * - Limit message count per conversation to maxHistoryMessages.
 * - Return defensive copies so external mutations cannot alter stored state.
 * - Cap total entries to prevent unbounded memory growth.
 */
export class ConversationStore {
  private readonly entries = new Map<string, conversation_entry>()
  private readonly ttlMs: number
  private readonly maxHistoryMessages: number
  private readonly maxEntries: number

  constructor(options: conversation_store_options = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxHistoryMessages = options.maxHistoryMessages ?? DEFAULT_MAX_HISTORY_MESSAGES
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  }

  private prune_expired(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key)
      }
    }
  }

  private enforce_max_entries(): void {
    while (this.entries.size > this.maxEntries) {
      const first = this.entries.keys().next()
      if (first.done) break
      this.entries.delete(first.value)
    }
  }

  /**
   * Returns a copy of the messages for the given key, or an empty array when
   * the key does not exist, the version does not match, or the entry has
   * expired. Expired entries are removed as a side effect.
   */
  get(key: string, version: number): panel_ai_message[] {
    const cached = this.entries.get(key)
    if (!cached || cached.version !== version || cached.expiresAt <= Date.now()) {
      if (cached && cached.expiresAt <= Date.now()) this.entries.delete(key)
      return []
    }
    return cached.messages.map((m) => ({ role: m.role, content: m.content }))
  }

  /**
   * Stores updated history for a key, automatically truncating to the last
   * maxHistoryMessages. A defensive copy of the input is stored.
   */
  set(key: string, version: number, messages: panel_ai_message[]): void {
    this.prune_expired()
    const truncated = messages.slice(-this.maxHistoryMessages).map((m) => ({ role: m.role, content: m.content }))
    this.entries.set(key, { version, messages: truncated, expiresAt: Date.now() + this.ttlMs })
    this.enforce_max_entries()
  }

  /**
   * Removes the entry for a key. Idempotent: deleting a missing key is a no-op.
   */
  delete(key: string): void {
    this.entries.delete(key)
  }

  /** Exposed for tests: clears all entries. */
  clear(): void {
    this.entries.clear()
  }
}
