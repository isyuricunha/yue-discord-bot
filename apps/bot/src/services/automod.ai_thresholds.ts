type ai_moderation_level = 'permissivo' | 'brando' | 'medio' | 'rigoroso' | 'maximo'

const openai_categories = [
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

type openai_category = (typeof openai_categories)[number]

type thresholds_map = Record<string, number>

function ai_threshold_for_level(level: ai_moderation_level): number {
  switch (level) {
    case 'permissivo':
      return 0.95
    case 'brando':
      return 0.85
    case 'medio':
      return 0.75
    case 'rigoroso':
      return 0.65
    case 'maximo':
      return 0.55
  }
}

function build_default_thresholds(level: ai_moderation_level): thresholds_map {
  const threshold = ai_threshold_for_level(level)
  const out: thresholds_map = {}
  for (const c of openai_categories) out[c] = threshold
  return out
}

function clamp_threshold(value: number): number {
  if (Number.isNaN(value)) return value
  return Math.max(0, Math.min(1, value))
}

export function build_ai_moderation_thresholds(
  level: ai_moderation_level,
  overrides: unknown,
): { thresholds: thresholds_map; applied_overrides: thresholds_map } {
  const thresholds = build_default_thresholds(level)
  const applied_overrides: thresholds_map = {}

  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return { thresholds, applied_overrides }
  }

  for (const [key, raw] of Object.entries(overrides as Record<string, unknown>)) {
    if (!openai_categories.includes(key as openai_category)) continue
    if (typeof raw !== 'number') continue
    if (Number.isNaN(raw)) continue
    const value = clamp_threshold(raw)
    thresholds[key] = value
    applied_overrides[key] = value
  }

  return { thresholds, applied_overrides }
}
