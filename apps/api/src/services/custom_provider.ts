import { CONFIG } from '../config'

export type custom_provider_model = {
  id: string
  group: string
  label: string
}

type custom_provider_models_response = {
  data?: Array<{ id?: unknown }>
}

function normalized_base_url() {
  const raw = CONFIG.panelAi.customProviderBaseUrl.trim().replace(/\/+$/, '')
  if (!raw) return null

  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Custom Provider URL must use HTTP or HTTPS')
  }

  return url.toString().replace(/\/$/, '')
}

export function custom_provider_endpoint(base_url: string, path: string) {
  const base = base_url.trim().replace(/\/+$/, '')
  if (!base) return null
  const url = new URL(base)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Custom Provider URL must use HTTP or HTTPS')
  const normalized = url.toString().replace(/\/$/, '')
  return normalized.endsWith('/v1') ? `${normalized}${path}` : `${normalized}/v1${path}`
}

function endpoint(path: string) {
  const base = normalized_base_url()
  if (!base) return null
  return custom_provider_endpoint(base, path)
}

function group_and_label(id: string) {
  const parts = id.split('/')
  const group = parts[0]?.trim() || 'other'
  const label = parts.slice(1).join('/').trim() || id
  return { group, label }
}

function sort_models(models: custom_provider_model[]) {
  return models.sort((a, b) =>
    a.group.localeCompare(b.group, 'pt-BR', { sensitivity: 'base' }) ||
    a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id, 'pt-BR', { sensitivity: 'base' })
  )
}

export function normalize_custom_provider_models(ids: unknown[]): custom_provider_model[] {
  const seen = new Set<string>()
  const models: custom_provider_model[] = []

  for (const value of ids) {
    if (typeof value !== 'string') continue
    const id = value.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const { group, label } = group_and_label(id)
    models.push({ id, group, label })
  }

  return sort_models(models)
}

async function request_json(url: string, init: RequestInit, timeout_ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeout_ms)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = await response.json().catch(() => null) as unknown
    if (!response.ok) {
      throw new Error(`Custom Provider request failed with status ${response.status}`)
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

function authorization_headers() {
  const key = CONFIG.panelAi.customProviderApiKey.trim()
  return {
    accept: 'application/json',
    ...(key ? { authorization: `Bearer ${key}` } : {}),
  }
}

export function custom_provider_is_configured() {
  try {
    return Boolean(normalized_base_url())
  } catch {
    return false
  }
}

export async function list_custom_provider_models(): Promise<custom_provider_model[]> {
  const url = endpoint('/models')
  if (!url) throw new Error('Custom Provider is not configured')

  const body = await request_json(url, { headers: authorization_headers() }, CONFIG.panelAi.modelCatalogTimeoutMs)
  const response = body as custom_provider_models_response
  return normalize_custom_provider_models((response.data ?? []).map((item) => item?.id))
}

export async function test_custom_provider_model(model: string) {
  const selected_model = model.trim()
  if (!selected_model) throw new Error('Custom Provider model is required')

  const url = endpoint('/chat/completions')
  if (!url) throw new Error('Custom Provider is not configured')

  const started_at = Date.now()
  await request_json(url, {
    method: 'POST',
    headers: {
      ...authorization_headers(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: selected_model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      temperature: 0,
    }),
  }, CONFIG.panelAi.chatTimeoutMs)

  return { model: selected_model, latencyMs: Date.now() - started_at }
}
