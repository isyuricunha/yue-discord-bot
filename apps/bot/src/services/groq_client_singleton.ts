import { GroqClient } from './groq.service'

let cached: GroqClient | null | undefined

export function get_groq_client(): GroqClient | null {
  if (cached !== undefined) return cached

  try {
    cached = GroqClient.from_env()
    return cached
  } catch {
    cached = null
    return null
  }
}
