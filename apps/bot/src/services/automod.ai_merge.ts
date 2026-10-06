import { openai_categories, type moderation_result, type openai_category } from './automod.ai_categories'

/**
 * Combine moderation results from the selected provider, the OpenAI image check
 * and the fallback provider. Category scores keep the highest value seen
 * (providers are not score-comparable, but within one call this is safe: each
 * category usually only comes from one of the results).
 */
export function merge_moderation_results(parts: Array<moderation_result | null>): moderation_result {
  const scores: Record<string, number> = {}
  const triggered = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    for (const [category, score] of Object.entries(part.scores)) {
      if (typeof score !== 'number' || !Number.isFinite(score)) continue
      scores[category] = Math.max(scores[category] ?? score, score)
    }
    for (const category of part.triggeredCategories) triggered.add(category)
  }

  return {
    ok: parts.some((part) => part?.ok),
    flagged: triggered.size > 0,
    triggeredCategories: openai_categories.filter((c) => triggered.has(c)) as openai_category[],
    scores,
  }
}
