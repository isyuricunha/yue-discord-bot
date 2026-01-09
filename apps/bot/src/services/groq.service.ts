import { readFile } from 'node:fs/promises'

import { safe_error_details } from '../utils/safe_error'

type groq_role = 'system' | 'user' | 'assistant'

type groq_message = {
  role: groq_role
  content: string
}

type groq_chat_completion_request = {
  model: string
  messages: groq_message[]
  temperature?: number
  max_tokens?: number
}

type groq_chat_completion_response = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

type groq_key_state = {
  api_key: string
  cooldown_until_ms: number
}

export type groq_completion_result = {
  content: string
  used_key_index: number
}

export class GroqApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly retry_after_seconds: number | null
  ) {
    super(message)
    this.name = 'GroqApiError'
  }
}

function parse_retry_after_seconds(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function env_keys(): string[] {
  const primary = process.env.GROQ_API_KEY
  const fallback_1 = process.env.GROQ_API_KEY_FALLBACK_1
  const fallback_2 = process.env.GROQ_API_KEY_FALLBACK_2

  const primary_trimmed = typeof primary === 'string' ? primary.trim() : ''
  if (!primary_trimmed) return []

  return [primary_trimmed, fallback_1, fallback_2].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

function env_model(): string {
  const value = process.env.GROQ_MODEL
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'llama3-8b-8192'
}

function env_temperature(): number {
  const value = process.env.GROQ_TEMPERATURE
  if (!value) return 0.2
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return 0.2
  return parsed
}

function env_max_tokens(): number {
  const value = process.env.GROQ_MAX_TOKENS
  if (!value) return 512
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 4096) return 512
  return parsed
}

async function read_prompt_file(path: string): Promise<string> {
  const content = await readFile(path, 'utf8')
  const trimmed = content.trim()
  return trimmed.length > 0 ? trimmed : default_system_prompt()
}

function default_system_prompt(): string {
  return (
    'You are Yue, a helpful Discord bot assistant.\n' +
    'Answer clearly and concisely.\n' +
    'If you are unsure, say so.\n' +
    'Avoid disallowed content and never request or reveal secrets.\n'
  )
}

export async function load_groq_system_prompt(): Promise<string> {
  const env_path = process.env.GROQ_PROMPT_PATH
  const path = typeof env_path === 'string' && env_path.trim().length > 0 ? env_path.trim() : null
  if (!path) return default_system_prompt()

  try {
    return await read_prompt_file(path)
  } catch {
    return default_system_prompt()
  }
}

export type groq_client_deps = {
  fetch_fn?: typeof fetch
  now_ms?: () => number
  system_prompt?: () => Promise<string>
}

export class GroqClient {
  private readonly keys: groq_key_state[]
  private readonly fetch_fn: typeof fetch
  private readonly now_ms: () => number
  private readonly system_prompt: () => Promise<string>

  constructor(keys: string[], deps: groq_client_deps = {}) {
    if (keys.length === 0) {
      throw new Error('GROQ_API_KEY is required to use Groq features')
    }

    this.keys = keys.map((api_key) => ({ api_key, cooldown_until_ms: 0 }))
    this.fetch_fn = deps.fetch_fn ?? fetch
    this.now_ms = deps.now_ms ?? (() => Date.now())
    this.system_prompt = deps.system_prompt ?? load_groq_system_prompt
  }

  static from_env(deps: groq_client_deps = {}): GroqClient {
    return new GroqClient(env_keys(), deps)
  }

  private pick_key_index(): number | null {
    const now = this.now_ms()

    for (let i = 0; i < this.keys.length; i += 1) {
      if (this.keys[i]!.cooldown_until_ms <= now) return i
    }

    return null
  }

  private earliest_cooldown_seconds(): number | null {
    const now = this.now_ms()
    const next = this.keys
      .map((k) => k.cooldown_until_ms)
      .filter((v) => v > now)
      .sort((a, b) => a - b)[0]

    if (!next) return null
    return Math.max(1, Math.ceil((next - now) / 1000))
  }

  private mark_cooldown(index: number, seconds: number): void {
    const now = this.now_ms()
    this.keys[index]!.cooldown_until_ms = Math.max(this.keys[index]!.cooldown_until_ms, now + seconds * 1000)
  }

  async create_completion(input: { user_prompt: string }): Promise<groq_completion_result> {
    const system_prompt = await this.system_prompt()

    const request: groq_chat_completion_request = {
      model: env_model(),
      messages: [
        { role: 'system', content: system_prompt },
        { role: 'user', content: input.user_prompt },
      ],
      temperature: env_temperature(),
      max_tokens: env_max_tokens(),
    }

    const attempted = new Set<number>()
    let last_error: unknown = null

    while (attempted.size < this.keys.length) {
      const key_index = this.pick_key_index()

      if (key_index === null) {
        const wait = this.earliest_cooldown_seconds()
        throw new GroqApiError('All Groq API keys are rate limited', 429, null, wait)
      }

      if (attempted.has(key_index)) {
        this.mark_cooldown(key_index, 1)
        continue
      }

      attempted.add(key_index)

      try {
        const result = await this.request_with_key(key_index, request)
        return { content: result, used_key_index: key_index }
      } catch (error: unknown) {
        last_error = error
        const should_fallback =
          error instanceof GroqApiError
            ? error.status === 401 || error.status === 403 || error.status === 429 || error.status >= 500
            : true

        if (error instanceof GroqApiError && error.status === 429) {
          const retry_after = error.retry_after_seconds ?? 10
          this.mark_cooldown(key_index, retry_after)
        } else if (should_fallback) {
          this.mark_cooldown(key_index, 1)
        }

        if (!should_fallback) throw error
      }
    }

    if (last_error) throw last_error
    throw new Error('Failed to get Groq completion')
  }

  private async request_with_key(key_index: number, request: groq_chat_completion_request): Promise<string> {
    const api_key = this.keys[key_index]!.api_key

    const controller = new AbortController()
    const timeout_ms = 12_000
    const timeout = setTimeout(() => controller.abort(), timeout_ms)

    try {
      const res = await this.fetch_fn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${api_key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      const retry_after_seconds = parse_retry_after_seconds(res.headers.get('retry-after'))

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as unknown
        const msg =
          body && typeof body === 'object' && 'error' in body
            ? String(((body as Record<string, any>).error?.message ?? '') as string)
            : `Groq API returned ${res.status}`

        throw new GroqApiError(msg || `Groq API returned ${res.status}`, res.status, body, retry_after_seconds)
      }

      const json = (await res.json()) as groq_chat_completion_response
      const content = json.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new GroqApiError('Groq API returned empty response', 502, json, null)
      }

      return content.trim()
    } catch (error: unknown) {
      if (error instanceof GroqApiError) throw error
      throw new GroqApiError('Groq API request failed', 502, safe_error_details(error), null)
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function create_groq_client_for_tests(input: {
  keys: string[]
  fetch_fn: typeof fetch
  now_ms: () => number
  system_prompt?: () => Promise<string>
}): GroqClient {
  return new GroqClient(input.keys, {
    fetch_fn: input.fetch_fn,
    now_ms: input.now_ms,
    system_prompt: input.system_prompt,
  })
}
