export type ai_moderation_provider = 'openai' | 'mistral'

/** Unknown/missing values resolve to OpenAI, matching the pre-provider default. */
export function resolve_ai_moderation_provider(provider: unknown): ai_moderation_provider {
  return provider === 'mistral' ? 'mistral' : 'openai'
}

/**
 * Whether the AI moderation flow has anything it can do for this guild config.
 * Images always depend on the OpenAI key, and the fallback only helps when the
 * other provider has a key, so a guild whose provider and fallback are both
 * keyless can skip the whole flow.
 */
export function should_run_ai_moderation(provider: ai_moderation_provider, fallback_enabled: boolean): boolean {
  const openai_key = Boolean(process.env.OPENAI_API_KEY)
  const mistral_key = Boolean(process.env.MISTRAL_API_KEY)
  if (openai_key) return true
  if (provider === 'mistral' && mistral_key) return true
  if (provider === 'openai') return fallback_enabled && mistral_key
  return fallback_enabled && openai_key
}
