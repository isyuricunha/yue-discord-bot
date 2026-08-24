import { Mistral } from '@mistralai/mistralai'
import {
  build_custom_provider_payload,
  custom_provider_endpoint,
} from '@yuebot/shared'

import { CONFIG } from '../config'
import { custom_provider_is_configured } from './custom_provider'
import {
  MistralEmptyResponseError,
  MistralNotConfiguredError,
  MistralTimeoutError,
  build_custom_provider_messages,
  build_mistral_agent_request,
  classify_mistral_failure,
  normalize_panel_ai_runtime,
  type mistral_agent_request,
  type panel_ai_completion_input,
  type panel_ai_dependencies,
  type panel_ai_runtime_event,
} from './panel_ai'

export type panel_ai_stream_dependencies = panel_ai_dependencies & {
  startMistralConversationStream?: (
    request: mistral_agent_request,
  ) => Promise<AsyncIterable<unknown>> | AsyncIterable<unknown>
  streamWithCustomProvider?: (
    input: panel_ai_completion_input,
    onDelta: (delta: string) => void,
  ) => Promise<string>
}

function safe_log_event(dependencies: panel_ai_stream_dependencies, event: panel_ai_runtime_event) {
  try {
    dependencies.logEvent?.(event)
  } catch {
    // Observability must never alter completion behavior.
  }
}

function extract_text_chunk(content: unknown): string {
  if (typeof content === 'string') return content
  if (!content || typeof content !== 'object') return ''
  const record = content as { type?: unknown; text?: unknown }
  if ((record.type === 'text' || record.type === undefined) && typeof record.text === 'string') {
    return record.text
  }
  return ''
}

export function extract_mistral_stream_delta(event: unknown): string {
  if (!event || typeof event !== 'object') return ''
  const eventRecord = event as { data?: unknown }
  const data = (eventRecord.data ?? event) as { type?: unknown; content?: unknown }
  if (data.type !== 'message.output.delta') return ''
  if (Array.isArray(data.content)) return data.content.map(extract_text_chunk).join('')
  return extract_text_chunk(data.content)
}

async function start_mistral_stream(
  request: mistral_agent_request,
  dependencies: panel_ai_stream_dependencies,
): Promise<AsyncIterable<unknown>> {
  const timeoutMs = dependencies.timeoutMs ?? CONFIG.panelAi.chatTimeoutMs
  let timeoutId: NodeJS.Timeout | undefined

  const streamPromise = Promise.resolve(
    dependencies.startMistralConversationStream
      ? dependencies.startMistralConversationStream(request)
      : new Mistral({ apiKey: CONFIG.panelAi.mistralApiKey }).beta.conversations.startStream(request),
  )

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new MistralTimeoutError(`Mistral Agent stream timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([streamPromise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function next_mistral_stream_event(
  iterator: AsyncIterator<unknown>,
  timeoutMs: number,
): Promise<IteratorResult<unknown>> {
  let timeoutId: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new MistralTimeoutError(`Mistral Agent stream stalled for ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([iterator.next(), timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function stream_with_mistral_agent(
  agentId: string,
  input: panel_ai_completion_input,
  dependencies: panel_ai_stream_dependencies,
  onDelta: (delta: string) => void,
): Promise<string> {
  const request = build_mistral_agent_request(agentId, input.context, input.messages)
  const timeoutMs = dependencies.timeoutMs ?? CONFIG.panelAi.chatTimeoutMs
  const stream = await start_mistral_stream(request, dependencies)
  const iterator = stream[Symbol.asyncIterator]()
  let content = ''

  try {
    while (true) {
      const event = await next_mistral_stream_event(iterator, timeoutMs)
      if (event.done) break
      const delta = extract_mistral_stream_delta(event.value)
      if (!delta) continue
      content += delta
      onDelta(delta)
    }
  } catch (error: unknown) {
    try {
      void Promise.resolve(iterator.return?.()).catch(() => undefined)
    } catch {
      // Best-effort stream cancellation only.
    }
    throw error
  }

  if (!content.trim()) throw new MistralEmptyResponseError('Panel AI returned an empty streamed response')
  return content
}

function custom_provider_chat_endpoint() {
  return custom_provider_endpoint(CONFIG.panelAi.customProviderBaseUrl, '/chat/completions')
}

function extract_openai_stream_delta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const body = payload as { choices?: Array<{ delta?: { content?: unknown } }> }
  const content = body.choices?.[0]?.delta?.content
  return typeof content === 'string' ? content : ''
}

function consume_openai_stream_line(line: string, onDelta: (delta: string) => void): string {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return ''
  const data = trimmed.slice(5).trim()
  if (!data || data === '[DONE]') return ''
  try {
    const delta = extract_openai_stream_delta(JSON.parse(data))
    if (delta) onDelta(delta)
    return delta
  } catch {
    // Ignore malformed provider event lines and continue the stream.
    return ''
  }
}

async function stream_with_custom_provider(
  input: panel_ai_completion_input,
  onDelta: (delta: string) => void,
  timeoutMs: number,
): Promise<string> {
  const model = input.runtime.customModel
  if (!model) throw new Error('Custom Provider model is not configured')
  const url = custom_provider_chat_endpoint()
  if (!url) throw new Error('Custom Provider is not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const apiKey = CONFIG.panelAi.customProviderApiKey.trim()
  let content = ''

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        ...build_custom_provider_payload({
          model,
          messages: build_custom_provider_messages(input.persona, input.context, input.messages),
          reasoningMode: input.runtime.customReasoningMode,
        }),
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`Panel AI request failed with status ${response.status}`)
    if (!response.body) throw new Error('Custom Provider did not return a stream')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) content += consume_openai_stream_line(line, onDelta)
    }

    buffer += decoder.decode()
    if (buffer.trim()) content += consume_openai_stream_line(buffer, onDelta)
  } finally {
    clearTimeout(timeout)
  }

  if (!content.trim()) throw new Error('Custom Provider returned an empty streamed response')
  return content
}

async function stream_custom(
  input: panel_ai_completion_input,
  dependencies: panel_ai_stream_dependencies,
  onDelta: (delta: string) => void,
) {
  if (dependencies.streamWithCustomProvider) {
    return dependencies.streamWithCustomProvider(input, onDelta)
  }
  return stream_with_custom_provider(
    input,
    onDelta,
    dependencies.timeoutMs ?? CONFIG.panelAi.chatTimeoutMs,
  )
}

async function stream_fallback(
  input: panel_ai_completion_input,
  classification: ReturnType<typeof classify_mistral_failure>,
  dependencies: panel_ai_stream_dependencies,
  onDelta: (delta: string) => void,
): Promise<string> {
  if (!classification.eligible) throw new Error('Panel AI fallback is not eligible')
  const modelId = input.runtime.customModel!
  safe_log_event(dependencies, {
    type: 'fallback_attempted',
    primaryProvider: 'mistral',
    fallbackProvider: 'custom',
    category: classification.category,
    statusCode: classification.statusCode,
    modelId,
  })
  try {
    const text = await stream_custom(input, dependencies, onDelta)
    safe_log_event(dependencies, {
      type: 'fallback_succeeded',
      primaryProvider: 'mistral',
      fallbackProvider: 'custom',
      category: classification.category,
      statusCode: classification.statusCode,
      modelId,
      success: true,
    })
    return text
  } catch (error: unknown) {
    safe_log_event(dependencies, {
      type: 'fallback_failed',
      primaryProvider: 'mistral',
      fallbackProvider: 'custom',
      category: classification.category,
      statusCode: classification.statusCode,
      modelId,
      success: false,
    })
    throw new Error('Panel AI fallback failed', { cause: error })
  }
}

export async function complete_panel_ai_stream(
  rawInput: panel_ai_completion_input,
  dependencies: panel_ai_stream_dependencies,
  onDelta: (delta: string) => void,
): Promise<string> {
  const runtime = normalize_panel_ai_runtime(rawInput.runtime)
  const input: panel_ai_completion_input = { ...rawInput, runtime }

  if (runtime.provider === 'custom') {
    return stream_custom(input, dependencies, onDelta)
  }

  const agentId = dependencies.mistralAgentId?.trim() || CONFIG.panelAi.mistralPanelAgentId.trim()
  const isMistralConfigured = Boolean(
    agentId &&
      (dependencies.startMistralConversationStream !== undefined ||
        dependencies.mistralApiKeyConfigured ||
        Boolean(CONFIG.panelAi.mistralApiKey.trim())),
  )
  const customConfigured = dependencies.customProviderConfigured ?? custom_provider_is_configured()
  const fallbackValid = runtime.fallbackEnabled && customConfigured && Boolean(runtime.customModel)

  if (!isMistralConfigured) {
    const error = new MistralNotConfiguredError('Mistral Panel Agent is not configured')
    const classification = classify_mistral_failure(error)
    if (fallbackValid && classification.eligible) {
      return stream_fallback(input, classification, dependencies, onDelta)
    }
    throw error
  }

  let emitted = false
  try {
    return await stream_with_mistral_agent(agentId, input, dependencies, (delta) => {
      emitted = true
      onDelta(delta)
    })
  } catch (error: unknown) {
    const classification = classify_mistral_failure(error)
    // Switching providers after visible output would duplicate or contradict a
    // partial answer. Fallback is therefore only safe before the first delta.
    if (!emitted && fallbackValid && classification.eligible) {
      return stream_fallback(input, classification, dependencies, onDelta)
    }
    throw error
  }
}
