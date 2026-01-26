import { discord_timeout_max_ms, duration_regex, parseDurationMs } from '@yuebot/shared'

type duration_validation = {
  normalized: string
  ms: number | null
  error: string | null
}

export function validate_timeout_duration(input: string): duration_validation {
  const normalized = typeof input === 'string' ? input.trim().toLowerCase() : ''

  if (!normalized) {
    return { normalized, ms: null, error: 'Informe uma duração (ex: 5m).' }
  }

  if (!duration_regex.test(normalized)) {
    return { normalized, ms: null, error: 'Formato inválido. Use 30s, 5m, 2h, 1d, 1w.' }
  }

  const ms = parseDurationMs(normalized)
  if (ms === null) {
    return { normalized, ms: null, error: 'Formato inválido. Use 30s, 5m, 2h, 1d, 1w.' }
  }

  if (ms > discord_timeout_max_ms) {
    return { normalized, ms, error: 'Máximo permitido: 28d.' }
  }

  return { normalized, ms, error: null }
}
