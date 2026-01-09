import type { conversation_message } from './groq_conversation_store'

export type groq_conversation_backend = {
  get_history: (key: string) => Promise<conversation_message[]>
  get_last_activity_ms: (key: string) => Promise<number | null>
  append: (key: string, message: conversation_message) => Promise<void>
  clear: (key: string) => Promise<void>
}
