import { CONFIG } from '../config'
import {
  custom_provider_endpoint,
  type custom_provider_reasoning_mode,
  custom_reasoning_parameters,
} from '@yuebot/shared'

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



export type custom_provider_test_deps = {
  requestJson?: (url: string, init: RequestInit, timeoutMs: number) => Promise<unknown>
  resolveEndpoint?: () => string | null
}

export async function test_custom_provider_model(
  model: string,
  mode: custom_provider_reasoning_mode = 'omit',
  deps: custom_provider_test_deps = {},
) {
  const selected_model = model.trim()
  if (!selected_model) throw new Error('Custom Provider model is required')

  const url = deps.resolveEndpoint ? deps.resolveEndpoint() : endpoint('/chat/completions')
  if (!url) throw new Error('Custom Provider is not configured')

  const reasoning_params = custom_reasoning_parameters(mode)

  const requestFn = deps.requestJson ?? request_json

  const started_at = Date.now()
  const body = (await requestFn(
    url,
    {
      method: 'POST',
      headers: {
        ...authorization_headers(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: selected_model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 512,
        temperature: 0,
        ...reasoning_params,
      }),
    },
    CONFIG.panelAi.chatTimeoutMs,
  )) as { choices?: Array<{ message?: { content?: unknown } }> } | null

  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Panel AI returned an empty response')
  }

  return { model: selected_model, reasoningMode: mode, latencyMs: Date.now() - started_at }
}
