type integer_query_options = {
  fallback: number
  min?: number
  max?: number
}

type pagination_query_options = {
  defaultLimit: number
  maxLimit: number
  defaultOffset?: number
}

export function parse_query_integer(value: unknown, options: integer_query_options): number {
  const input = Array.isArray(value) ? value[0] : value
  let parsed: number | null = null

  if (typeof input === 'number' && Number.isSafeInteger(input)) {
    parsed = input
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (/^[+-]?\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isSafeInteger(numeric)) parsed = numeric
    }
  }

  if (parsed === null) return options.fallback

  if (options.min !== undefined && parsed < options.min) return options.min
  if (options.max !== undefined && parsed > options.max) return options.max

  return parsed
}

export function parse_pagination_query(query: unknown, options: pagination_query_options) {
  const input = query && typeof query === 'object' ? query as Record<string, unknown> : {}

  return {
    limit: parse_query_integer(input.limit, {
      fallback: options.defaultLimit,
      min: 1,
      max: options.maxLimit,
    }),
    offset: parse_query_integer(input.offset, {
      fallback: options.defaultOffset ?? 0,
      min: 0,
    }),
  }
}
