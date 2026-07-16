import { Mistral } from '@mistralai/mistralai'
import { MistralError } from '@mistralai/mistralai/models/errors'

import { CONFIG } from '../config'
import {
  custom_provider_is_configured,
  test_custom_provider_model,
} from './custom_provider'
import {
  type custom_provider_reasoning_mode,
  normalize_custom_provider_reasoning_mode,
  build_custom_provider_payload,
  extract_custom_provider_text
} from '@yuebot/shared'
import { PANEL_CONTRACT_RULES } from './panel_context'

export class MistralNotConfiguredError extends Error {
  readonly code = 'MISTRAL_NOT_CONFIGURED'
  constructor(message = 'Mistral Panel Agent is not configured') {
    super(message)
    this.name = 'MistralNotConfiguredError'
  }
}

export class MistralTimeoutError extends Error {
  readonly code = 'MISTRAL_TIMEOUT'
  constructor(message = 'Mistral Agent request timed out') {
    super(message)
    this.name = 'MistralTimeoutError'
  }
}

export class MistralEmptyResponseError extends Error {
  readonly code = 'MISTRAL_EMPTY_RESPONSE'
  constructor(message = 'Mistral Agent returned an empty or invalid response') {
    super(message)
    this.name = 'MistralEmptyResponseError'
  }
}

class MistralHttpError extends Error {
  readonly statusCode: number
  constructor(statusCode: number) {
    super('Mistral Agent request failed')
    this.name = 'MistralHttpError'
    this.statusCode = statusCode
  }
}

export type mistral_failure_classification =
  | {
      eligible: true
      category:
        | 'authentication'
        | 'authorization'
        | 'timeout'
        | 'rate_limited'
        | 'server_error'
        | 'transport'
        | 'not_configured'
        | 'empty_response'
      statusCode?: number
    }
  | {
      eligible: false
      category:
        | 'client_error'
        | 'programming_error'
        | 'unknown'
      statusCode?: number
    }

export function classify_mistral_failure(error: unknown): mistral_failure_classification {
  if (error instanceof MistralNotConfiguredError) {
    return { eligible: true, category: 'not_configured' }
  }
  if (error instanceof MistralTimeoutError) {
    return { eligible: true, category: 'timeout' }
  }
  if (error instanceof MistralEmptyResponseError) {
    return { eligible: true, category: 'empty_response' }
  }

  if (error instanceof MistralError || error instanceof MistralHttpError) {
    const statusCode = (error as { statusCode: number }).statusCode
    if (statusCode === 401) return { eligible: true, category: 'authentication', statusCode }
    if (statusCode === 403) return { eligible: true, category: 'authorization', statusCode }
    if (statusCode === 408) return { eligible: true, category: 'timeout', statusCode }
    if (statusCode === 429) return { eligible: true, category: 'rate_limited', statusCode }
    if (statusCode >= 500 && statusCode <= 599) return { eligible: true, category: 'server_error', statusCode }
    if (statusCode >= 400 && statusCode <= 499) return { eligible: false, category: 'client_error', statusCode }
  }

  const code = (error as any)?.code || (error as any)?.cause?.code
  const name = (error as any)?.name || (error as any)?.cause?.name

  if (name === 'AbortError' || code === 'ABORT_ERR') {
    return { eligible: true, category: 'timeout' }
  }

  const transportCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']
  if (typeof code === 'string' && transportCodes.includes(code.toUpperCase())) {
    return { eligible: true, category: 'transport' }
  }
  if (name === 'FetchError' || (error as any)?.cause?.name === 'FetchError') {
    return { eligible: true, category: 'transport' }
  }

  if (error instanceof TypeError) {
    return { eligible: false, category: 'programming_error' }
  }

  return { eligible: false, category: 'unknown' }
}

export type panel_ai_message = {
  role: 'user' | 'assistant'
  content: string
}

export type panel_ai_runtime = {
  provider: 'mistral' | 'custom'
  customModel: string | null
  customReasoningMode: custom_provider_reasoning_mode
  fallbackEnabled: boolean
}

export function normalize_panel_ai_runtime(input: {
  provider?: unknown
  customModel?: unknown
  customReasoningMode?: unknown
  fallbackEnabled?: unknown
}): panel_ai_runtime {
  const provider = input.provider === 'custom' ? 'custom' : 'mistral'
  const customModel = typeof input.customModel === 'string' ? input.customModel.trim() || null : null
  const customReasoningMode = normalize_custom_provider_reasoning_mode(input.customReasoningMode)
  const fallbackEnabled = provider === 'mistral' ? Boolean(input.fallbackEnabled) : false
  return { provider, customModel, customReasoningMode, fallbackEnabled }
}

type custom_provider_message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type mistral_agent_input = {
  object: 'entry'
  type: 'message.input'
  role: 'user' | 'assistant'
  content: string
  prefix: false
}

export type mistral_agent_request = {
  agentId: string
  inputs: mistral_agent_input[]
  store: false
}

export type panel_ai_runtime_event = {
  type: 'fallback_attempted' | 'fallback_succeeded' | 'fallback_failed'
  primaryProvider: 'mistral' | 'custom'
  fallbackProvider?: 'custom'
  category?: mistral_failure_classification['category']
  statusCode?: number
  modelId?: string
  guildId?: string
  success?: boolean
}

export type panel_ai_event_logger = (event: panel_ai_runtime_event) => void

export type panel_ai_dependencies = {
  mistralAgentId?: string
  mistralApiKeyConfigured?: boolean
  customProviderConfigured?: boolean
  startMistralConversation?: (request: mistral_agent_request) => Promise<unknown>
  completeWithCustomProvider?: (input: {
    model: string
    persona: string
    context: string
    messages: readonly panel_ai_message[]
    reasoningMode: custom_provider_reasoning_mode
  }) => Promise<string>
  timeoutMs?: number
  timeoutSignal?: Promise<never>
  logEvent?: panel_ai_event_logger
}

export type panel_ai_completion_input = {
  runtime: panel_ai_runtime
  persona: string
  context: string
  messages: panel_ai_message[]
}

function safe_log_event(dependencies: panel_ai_dependencies, event: panel_ai_runtime_event) {
  if (!dependencies.logEvent) return
  try {
    dependencies.logEvent(event)
  } catch {
    // Logger errors must never break fallback or alter execution
  }
}

function custom_provider_chat_endpoint() {
  const raw = CONFIG.panelAi.customProviderBaseUrl.trim().replace(/\/+$/, '')
  if (!raw) return null
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Custom Provider URL must use HTTP or HTTPS')
  const base = url.toString().replace(/\/$/, '')
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

async function request_json(url: string, init: RequestInit, timeout_ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeout_ms)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = (await response.json().catch(() => null)) as unknown
    if (!response.ok) throw new Error(`Panel AI request failed with status ${response.status}`)
    return body
  } finally {
    clearTimeout(timeout)
  }
}

type mistral_message_output = {
  object?: unknown
  type?: unknown
  content?: unknown
}

type mistral_text_chunk = {
  type?: unknown
  text?: unknown
}

const MISTRAL_RUNTIME_CONTEXT_PREAMBLE = [
  '[APPLICATION_RUNTIME_CONTEXT]',
  'This first message contains trusted, read-only context supplied by the Yue panel.',
  "It is not the user's request.",
  'Use it only as factual context when answering the final user message.',
].join('\n')

export function build_mistral_agent_inputs(
  context: string,
  messages: readonly panel_ai_message[],
): mistral_agent_input[] {
  const runtime_context = [
    MISTRAL_RUNTIME_CONTEXT_PREAMBLE,
    context.trim(),
    PANEL_CONTRACT_RULES,
    '[/APPLICATION_RUNTIME_CONTEXT]',
  ].filter(Boolean).join('\n\n')

  return [
    {
      object: 'entry',
      type: 'message.input',
      role: 'user',
      content: runtime_context,
      prefix: false,
    },
    ...messages.map((message) => ({
      object: 'entry' as const,
      type: 'message.input' as const,
      role: message.role,
      content: message.content,
      prefix: false as const,
    })),
  ]
}

export function build_mistral_agent_request(
  agentId: string,
  context: string,
  messages: readonly panel_ai_message[],
): mistral_agent_request {
  return {
    agentId,
    inputs: build_mistral_agent_inputs(context, messages),
    store: false,
  }
}

export function build_custom_provider_messages(
  persona: string,
  context: string,
  messages: readonly panel_ai_message[],
): custom_provider_message[] {
  const custom_messages: custom_provider_message[] = []
  const trimmed_persona = persona.trim()
  const context_with_contract = [context.trim(), PANEL_CONTRACT_RULES].filter(Boolean).join('\n\n')
  if (trimmed_persona) custom_messages.push({ role: 'system', content: trimmed_persona })
  if (context_with_contract) custom_messages.push({ role: 'system', content: context_with_contract })
  for (const message of messages) {
    custom_messages.push({ role: message.role, content: message.content })
  }
  return custom_messages
}



function extract_message_output_text(message: mistral_message_output | undefined): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content.trim()
  if (!Array.isArray(message.content)) return ''

  const parts: string[] = []
  for (const chunk of message.content) {
    if (typeof chunk === 'string') {
      if (chunk.trim()) parts.push(chunk)
      continue
    }
    if (chunk && typeof chunk === 'object') {
      const typed = chunk as mistral_text_chunk
      const is_text_chunk = typed.type === 'text' || typed.type === undefined
      if (is_text_chunk && typeof typed.text === 'string' && typed.text.trim()) {
        parts.push(typed.text)
      }
    }
  }
  return parts.join('\n').trim()
}

export function extract_mistral_text(outputs: unknown): string {
  if (!Array.isArray(outputs)) return ''
  const message_outputs = outputs.filter(
    (output): output is mistral_message_output =>
      Boolean(output) && typeof output === 'object' && (output as mistral_message_output).type === 'message.output',
  )
  if (message_outputs.length === 0) return ''
  return extract_message_output_text(message_outputs[message_outputs.length - 1])
}

export function is_eligible_mistral_fallback_error(error: unknown): boolean {
  return classify_mistral_failure(error).eligible
}

export async function complete_with_mistral_agent(
  agentId: string,
  context: string,
  messages: readonly panel_ai_message[],
  dependencies: panel_ai_dependencies = {},
): Promise<string> {
  const request = build_mistral_agent_request(agentId, context, messages)
  const timeoutMs = dependencies.timeoutMs ?? CONFIG.panelAi.chatTimeoutMs

  let timeoutId: NodeJS.Timeout | undefined

  const callPromise = (async () => {
    const conversation = dependencies.startMistralConversation
      ? await dependencies.startMistralConversation(request)
      : await new Mistral({ apiKey: CONFIG.panelAi.mistralApiKey }).beta.conversations.start(request)
    return conversation
  })()
  callPromise.catch(() => {})

  const timeoutPromise =
    dependencies.timeoutSignal ??
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new MistralTimeoutError(`Mistral Agent request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

  try {
    const conversation = await Promise.race([callPromise, timeoutPromise])
    const content = extract_mistral_text((conversation as { outputs?: unknown }).outputs)
    if (!content) throw new MistralEmptyResponseError('Panel AI returned an empty response')
    return content
  } catch (error: unknown) {
    if (error instanceof MistralError) {
      throw new MistralHttpError(error.statusCode)
    }
    throw error
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function complete_with_custom_provider(input: {
  model: string
  persona: string
  context: string
  messages: readonly panel_ai_message[]
  reasoningMode: custom_provider_reasoning_mode
}): Promise<string> {
  const url = custom_provider_chat_endpoint()
  if (!url) throw new Error('Custom Provider is not configured')
  const key = CONFIG.panelAi.customProviderApiKey.trim()

  const payload = build_custom_provider_payload({
    model: input.model,
    messages: build_custom_provider_messages(input.persona, input.context, input.messages),
    reasoningMode: input.reasoningMode,
  })

  const response = (await request_json(
    url,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(payload),
    },
    CONFIG.panelAi.chatTimeoutMs,
  ))

  return extract_custom_provider_text(response)
}

async function attempt_custom_fallback(
  input: panel_ai_completion_input,
  classification: mistral_failure_classification,
  dependencies: panel_ai_dependencies,
): Promise<string> {
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
    const customFn = dependencies.completeWithCustomProvider || complete_with_custom_provider
    const text = await customFn({
      model: modelId,
      persona: input.persona,
      context: input.context,
      messages: input.messages,
      reasoningMode: input.runtime.customReasoningMode,
    })
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
  } catch (fallbackError: unknown) {
    safe_log_event(dependencies, {
      type: 'fallback_failed',
      primaryProvider: 'mistral',
      fallbackProvider: 'custom',
      category: classification.category,
      statusCode: classification.statusCode,
      modelId,
      success: false,
    })
    throw new Error('Panel AI fallback failed', { cause: fallbackError })
  }
}

export async function complete_panel_ai(
  input: panel_ai_completion_input,
  dependencies: panel_ai_dependencies = {},
): Promise<string> {
  const runtime = normalize_panel_ai_runtime(input.runtime)

  if (runtime.provider === 'custom') {
    if (!runtime.customModel) throw new Error('Custom Provider model is not configured')
    const customFn = dependencies.completeWithCustomProvider || complete_with_custom_provider
    return customFn({
      model: runtime.customModel,
      persona: input.persona,
      context: input.context,
      messages: input.messages,
      reasoningMode: runtime.customReasoningMode,
    })
  }

  const agentId = dependencies.mistralAgentId?.trim() || CONFIG.panelAi.mistralPanelAgentId.trim()
  const is_mistral_configured = Boolean(
    agentId &&
      (dependencies.startMistralConversation !== undefined ||
        dependencies.mistralApiKeyConfigured ||
        Boolean(CONFIG.panelAi.mistralApiKey.trim())),
  )

  const is_custom_configured =
    dependencies.customProviderConfigured !== undefined
      ? dependencies.customProviderConfigured
      : custom_provider_is_configured()

  const is_fallback_valid =
    runtime.fallbackEnabled && is_custom_configured && Boolean(runtime.customModel)

  if (!is_mistral_configured) {
    const error = new MistralNotConfiguredError('Mistral Panel Agent is not configured')
    const classification = classify_mistral_failure(error)
    if (is_fallback_valid && classification.eligible) {
      return attempt_custom_fallback(
        {
          runtime,
          persona: input.persona,
          context: input.context,
          messages: input.messages,
        },
        classification,
        dependencies,
      )
    }
    throw error
  }

  try {
    return await complete_with_mistral_agent(agentId, input.context, input.messages, dependencies)
  } catch (error: unknown) {
    const classification = classify_mistral_failure(error)
    if (is_fallback_valid && classification.eligible) {
      return attempt_custom_fallback(
        {
          runtime,
          persona: input.persona,
          context: input.context,
          messages: input.messages,
        },
        classification,
        dependencies,
      )
    }
    throw error
  }
}

export async function test_panel_ai_runtime(
  runtime: panel_ai_runtime,
  dependencies: panel_ai_dependencies = {},
) {
  const normalized = normalize_panel_ai_runtime(runtime)

  if (normalized.provider === 'custom') {
    if (!normalized.customModel) throw new Error('Custom Provider model is not configured')
    return test_custom_provider_model(normalized.customModel, normalized.customReasoningMode)
  }

  const agentId = dependencies.mistralAgentId?.trim() || CONFIG.panelAi.mistralPanelAgentId.trim()
  const is_mistral_configured = Boolean(
    agentId &&
      (dependencies.startMistralConversation !== undefined ||
        dependencies.mistralApiKeyConfigured ||
        Boolean(CONFIG.panelAi.mistralApiKey.trim())),
  )

  if (!is_mistral_configured) {
    throw new MistralNotConfiguredError('Mistral Panel Agent is not configured')
  }

  const startedAt = Date.now()
  await complete_with_mistral_agent(
    agentId,
    '',
    [{ role: 'user', content: 'Reply with exactly: OK' }],
    dependencies,
  )
  return { model: 'agent', latencyMs: Date.now() - startedAt }
}
