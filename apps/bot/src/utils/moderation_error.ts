import axios from 'axios'
import { safe_error_details } from './safe_error'

export type moderation_error_summary = {
  kind: 'timeout' | 'bad_request' | 'rate_limited' | 'auth' | 'network' | 'unknown'
  status?: number
  code?: string
  message: string
}

/**
 * Classify provider HTTP errors for moderation services (OpenAI, Mistral).
 * Shared because both services apply the same failure policy.
 */
export function summarize_moderation_error(error: unknown): moderation_error_summary {
  const details = safe_error_details(error)
  const code = typeof details.code === 'string' ? details.code : undefined
  const status = typeof details.status === 'number'
    ? details.status
    : typeof details.statusCode === 'number'
      ? details.statusCode
      : undefined

  if (code === 'ECONNABORTED') {
    return { kind: 'timeout', code, status, message: details.message }
  }

  if (status === 400) {
    return { kind: 'bad_request', code, status, message: details.message }
  }

  if (status === 401 || status === 403) {
    return { kind: 'auth', code, status, message: details.message }
  }

  if (status === 429) {
    return { kind: 'rate_limited', code, status, message: details.message }
  }

  if (typeof status === 'number') {
    return { kind: 'unknown', code, status, message: details.message }
  }

  if (axios.isAxiosError(error)) {
    return { kind: 'network', code, status, message: details.message }
  }

  return { kind: 'unknown', code, status, message: details.message }
}
