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
  // Trim matches the API availability endpoint: a whitespace-only key is not
  // a usable provider.
  const openai_key = Boolean(process.env.OPENAI_API_KEY?.trim())
  const mistral_key = Boolean(process.env.MISTRAL_API_KEY?.trim())
  const primary_key = provider === 'mistral' ? mistral_key : openai_key
  if (primary_key || openai_key) return true
  // No primary key and no OpenAI key: only the fallback provider could run.
  return fallback_enabled && mistral_key
}
