import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

import { groq_conversation_store } from './groq_conversation_store'
import type { groq_conversation_backend } from './groq_conversation_backend'
import { RedisGroqConversationStore } from './groq_conversation_redis'

let cached_backend: groq_conversation_backend | null = null

export function get_groq_conversation_backend(): groq_conversation_backend {
  if (cached_backend) return cached_backend

  const redis_url = process.env.REDIS_URL
  if (typeof redis_url === 'string' && redis_url.trim().length > 0) {
    try {
      const redis_backend = new RedisGroqConversationStore({ redis_url })

      const fallback = groq_conversation_store

      cached_backend = {
        get_history: async (key) => {
          try {
            return await redis_backend.get_history(key)
          } catch (error: unknown) {
            logger.warn({ err: safe_error_details(error) }, 'Redis Groq conversation store failed, falling back to memory')
            cached_backend = fallback
            return await fallback.get_history(key)
          }
        },
        get_last_activity_ms: async (key) => {
          try {
            return await redis_backend.get_last_activity_ms(key)
          } catch (error: unknown) {
            logger.warn({ err: safe_error_details(error) }, 'Redis Groq conversation store failed, falling back to memory')
            cached_backend = fallback
            return await fallback.get_last_activity_ms(key)
          }
        },
        append: async (key, message) => {
          try {
            await redis_backend.append(key, message)
          } catch (error: unknown) {
            logger.warn({ err: safe_error_details(error) }, 'Redis Groq conversation store failed, falling back to memory')
            cached_backend = fallback
            await fallback.append(key, message)
          }
        },
        clear: async (key) => {
          try {
            await redis_backend.clear(key)
          } catch (error: unknown) {
            logger.warn({ err: safe_error_details(error) }, 'Redis Groq conversation store failed, falling back to memory')
            cached_backend = fallback
            await fallback.clear(key)
          }
        },
      }

      return cached_backend
    } catch (error: unknown) {
      logger.warn({ err: safe_error_details(error) }, 'Failed to init Redis Groq conversation store, falling back to memory')
    }
  }

  cached_backend = groq_conversation_store
  return cached_backend
}
