/**
 * Category taxonomies shared by the AI moderation services.
 *
 * Panel thresholds and logs speak the OpenAI taxonomy (the provider the panel
 * has always used). Mistral moderation results are mapped onto it, because the
 * two taxonomies are not 1:1: one Mistral category may cover more than one
 * OpenAI category.
 */

export const openai_categories = [
  'harassment',
  'harassment/threatening',
  'hate',
  'hate/threatening',
  'illicit',
  'illicit/violent',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
] as const

export type openai_category = (typeof openai_categories)[number]

/** Mistral moderation category keys (mistral-moderation-latest response). */
export const mistral_categories = [
  'sexual',
  'hate_and_discrimination',
  'violence_and_threats',
  'dangerous_and_criminal_content',
  'selfharm',
  'health',
  'financial',
  'law',
  'pii',
] as const

export type mistral_category = (typeof mistral_categories)[number]

/** Shared result shape returned by every moderation service (OpenAI, Mistral). */
export type moderation_result = {
  /** Whether the provider request actually ran (false: missing key or call failure). */
  ok: boolean
  flagged: boolean
  /** Categories that exceeded the configured threshold (OpenAI taxonomy). */
  triggeredCategories: openai_category[]
  /** Raw category scores, mapped to the OpenAI taxonomy. */
  scores: Record<string, number>
}

export const mistral_to_openai_categories: Record<mistral_category, readonly openai_category[] | null> = {
  sexual: ['sexual'],
  // Mistral merges hate and discrimination into one score; it covers both
  // OpenAI harassment and hate.
  hate_and_discrimination: ['hate', 'harassment'],
  // Threatening content falls under harassment/threatening in OpenAI's taxonomy.
  violence_and_threats: ['violence', 'harassment/threatening'],
  dangerous_and_criminal_content: ['illicit'],
  selfharm: ['self-harm'],
  // No Yue equivalent: ignored, documented in the panel provider description.
  health: null,
  financial: null,
  law: null,
  pii: null,
}
