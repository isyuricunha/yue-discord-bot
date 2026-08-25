import { useCallback, useMemo } from 'react'
import type {
  panel_ai_action,
  panel_ai_page_context,
  panel_ai_sensitive_request,
} from '@yuebot/shared'

import { getApiUrl } from '../env'

const API_URL = getApiUrl()

type chat_send_result =
  | {
      ok: true
      response: string
      actions: panel_ai_action[]
      sensitiveRequest: panel_ai_sensitive_request | null
    }
  | { ok: false; error: string }

type panel_assistant_client = {
  send: (
    message: string,
    signal: AbortSignal,
    pageContext?: panel_ai_page_context,
    onDelta?: (delta: string) => void,
  ) => Promise<chat_send_result>
  confirmSensitive: (
    requestId: string,
    signal: AbortSignal,
    onDelta?: (delta: string) => void,
  ) => Promise<chat_send_result>
}

type sse_done_payload = {
  response?: unknown
  actions?: unknown
  sensitiveRequest?: unknown
}

function as_actions(value: unknown): panel_ai_action[] {
  return Array.isArray(value)
    ? value.filter((item): item is panel_ai_action => Boolean(item) && typeof item === 'object')
    : []
}

function as_sensitive_request(value: unknown): panel_ai_sensitive_request | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const request = value as Record<string, unknown>
  if (
    typeof request.id !== 'string' ||
    typeof request.scope !== 'string' ||
    typeof request.title !== 'string' ||
    typeof request.description !== 'string' ||
    typeof request.preview !== 'string' ||
    typeof request.expiresAt !== 'string'
  ) return null
  return request as panel_ai_sensitive_request
}

function parse_done_payload(value: unknown): chat_send_result | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as sse_done_payload
  if (typeof payload.response !== 'string') return null
  return {
    ok: true,
    response: payload.response,
    actions: as_actions(payload.actions),
    sensitiveRequest: as_sensitive_request(payload.sensitiveRequest),
  }
}

function parse_json_success(value: unknown): chat_send_result | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.response !== 'string') return null
  return {
    ok: true,
    response: data.response,
    actions: as_actions(data.actions),
    sensitiveRequest: as_sensitive_request(data.sensitiveRequest),
  }
}

function next_sse_boundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf < 0 && crlf < 0) return null
  if (lf >= 0 && (crlf < 0 || lf < crlf)) return { index: lf, length: 2 }
  return { index: crlf, length: 4 }
}

function parse_sse_block(block: string): { event: string; data: unknown } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const rawLine of block.split(/\r?\n/)) {
    if (rawLine.startsWith('event:')) event = rawLine.slice(6).trim()
    if (rawLine.startsWith('data:')) dataLines.push(rawLine.slice(5).trimStart())
  }
  if (dataLines.length === 0) return null
  const rawData = dataLines.join('\n')
  try {
    return { event, data: JSON.parse(rawData) }
  } catch {
    return null
  }
}

async function read_stream_response(
  response: Response,
  signal: AbortSignal,
  onDelta?: (delta: string) => void,
): Promise<chat_send_result> {
  // Unit tests and older mocked fetch implementations may not expose a web
  // ReadableStream. Preserve the JSON contract as a compatibility path.
  if (!response.body || typeof response.body.getReader !== 'function') {
    const data = await response.json().catch(() => null)
    return parse_json_success(data) ?? { ok: false, error: 'Resposta inválida do assistente' }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let doneResult: chat_send_result | null = null

  try {
    while (true) {
      if (signal.aborted) return { ok: false, error: 'Cancelled' }
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const boundary = next_sse_boundary(buffer)
        if (!boundary) break
        const block = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary.length)
        const parsed = parse_sse_block(block)
        if (!parsed) continue

        if (parsed.event === 'delta') {
          const text = (parsed.data as { text?: unknown } | null)?.text
          if (typeof text === 'string' && text) onDelta?.(text)
          continue
        }
        if (parsed.event === 'done') {
          doneResult = parse_done_payload(parsed.data)
          continue
        }
        if (parsed.event === 'error') {
          const error = (parsed.data as { error?: unknown } | null)?.error
          return { ok: false, error: typeof error === 'string' ? error : 'Serviço indisponível' }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return doneResult ?? { ok: false, error: 'Resposta incompleta do assistente' }
}

async function post_stream(
  url: string,
  signal: AbortSignal,
  payload: unknown,
  onDelta?: (delta: string) => void,
): Promise<chat_send_result> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(payload),
      credentials: 'include',
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return {
        ok: false,
        error: typeof body?.error === 'string' ? body.error : 'Serviço indisponível',
      }
    }

    return await read_stream_response(response, signal, onDelta)
  } catch (error: unknown) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return { ok: false, error: 'Cancelled' }
    }
    return { ok: false, error: 'Falha na comunicação' }
  }
}

export function usePanelAssistant(guildId: string | undefined): panel_assistant_client {
  const send = useCallback(
    async (
      message: string,
      signal: AbortSignal,
      pageContext?: panel_ai_page_context,
      onDelta?: (delta: string) => void,
    ): Promise<chat_send_result> => {
      if (!guildId) return { ok: false, error: 'Guild unavailable' }
      return post_stream(
        `${API_URL}/api/guilds/${guildId}/panel-ai/chat/stream`,
        signal,
        pageContext ? { message, pageContext } : { message },
        onDelta,
      )
    },
    [guildId],
  )

  const confirmSensitive = useCallback(
    async (
      requestId: string,
      signal: AbortSignal,
      onDelta?: (delta: string) => void,
    ): Promise<chat_send_result> => {
      if (!guildId) return { ok: false, error: 'Guild unavailable' }
      return post_stream(
        `${API_URL}/api/guilds/${guildId}/panel-ai/sensitive-context/${encodeURIComponent(requestId)}/confirm/stream`,
        signal,
        {},
        onDelta,
      )
    },
    [guildId],
  )

  return useMemo(() => ({ send, confirmSensitive }), [confirmSensitive, send])
}
