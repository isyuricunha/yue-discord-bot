export type custom_provider_reasoning_mode =
  | 'omit'
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'

export function normalize_custom_provider_reasoning_mode(value: unknown): custom_provider_reasoning_mode {
  if (
    value === 'none' ||
    value === 'minimal' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  ) {
    return value
  }
  return 'omit'
}

export function custom_reasoning_parameters(mode: custom_provider_reasoning_mode): Record<string, string> {
  switch (mode) {
    case 'none':
      return { reasoning_effort: 'none' }
    case 'minimal':
      return { reasoning_effort: 'minimal' }
    case 'low':
      return { reasoning_effort: 'low' }
    case 'medium':
      return { reasoning_effort: 'medium' }
    case 'high':
      return { reasoning_effort: 'high' }
    case 'omit':
    default:
      return {}
  }
}

export function custom_provider_endpoint(base_url: string, path: string) {
  const base = base_url.trim().replace(/\/+$/, '')
  if (!base) return null
  const url = new URL(base)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Custom Provider URL must use HTTP or HTTPS')
  }
  const normalized = url.toString().replace(/\/$/, '')
  return normalized.endsWith('/v1') ? `${normalized}${path}` : `${normalized}/v1${path}`
}

export type custom_provider_message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type custom_completion_response = {
  choices?: Array<{ message?: { content?: unknown } }>
}

export function build_custom_provider_payload(input: {
  model: string
  messages: readonly custom_provider_message[]
  reasoningMode: custom_provider_reasoning_mode
  temperature?: number
}) {
  const reasoning_params = custom_reasoning_parameters(input.reasoningMode)
  return {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.4,
    ...reasoning_params,
  }
}

export function extract_custom_provider_text(response: unknown): string {
  const body = response as custom_completion_response | null | undefined
  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Custom Provider returned an empty response')
  }
  return content.trim()
}
