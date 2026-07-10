import { Mistral } from '@mistralai/mistralai'

import { CONFIG } from '../config'
import { test_custom_provider_model } from './custom_provider'
import { PANEL_CONTRACT_RULES } from './panel_context'
export type panel_ai_message = {
  role: 'user' | 'assistant'
  content: string
}

type panel_ai_runtime = {
  provider: 'mistral' | 'custom'
  customModel: string | null
}

type custom_completion_response = {
  choices?: Array<{ message?: { content?: unknown } }>
}

type custom_provider_message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type panel_ai_completion_input = {
  runtime: panel_ai_runtime
  /** Persona loaded from file; sent only to the Custom Provider. */
  persona: string
  /** Transient, structured, authorized context; never persisted into history. */
  context: string
  /** Natural conversation history (user/assistant only). */
  messages: panel_ai_message[]
}

function custom_provider_chat_endpoint() {
  const raw = CONFIG.panelAi.customProviderBaseUrl.trim().replace(/\/+$/, '')
  if (!raw) return null
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Custom Provider URL must use HTTP or HTTPS')
  const base = url.toString().replace(/\/$/, '')
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

async function request_json(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CONFIG.panelAi.chatTimeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = await response.json().catch(() => null) as unknown
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

function build_mistral_instructions(context: string): string {
  return [context, '', PANEL_CONTRACT_RULES].filter(Boolean).join('\n\n')
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
      // The SDK allows TextChunk with optional type: accept when absent or "text".
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

export async function complete_panel_ai(input: panel_ai_completion_input): Promise<string> {
  if (input.runtime.provider === 'custom') {
    if (!input.runtime.customModel) throw new Error('Custom Provider model is not configured')
    const url = custom_provider_chat_endpoint()
    if (!url) throw new Error('Custom Provider is not configured')
    const key = CONFIG.panelAi.customProviderApiKey.trim()
    const persona = input.persona.trim()
    const context = input.context.trim()

    const custom_messages: custom_provider_message[] = []
    if (persona) custom_messages.push({ role: 'system', content: persona })
    // Send the contract rules to the Custom Provider alongside the structured
    // context, so the model receives the same anti-invention protections as
    // the Mistral Agent does. Do not rely on the private persona file to
    // contain these protections.
    const context_with_contract = [context, PANEL_CONTRACT_RULES].filter(Boolean).join('\n\n')
    if (context_with_contract) custom_messages.push({ role: 'system', content: context_with_contract })
    for (const message of input.messages) {
      custom_messages.push({ role: message.role, content: message.content })
    }

    const response = await request_json(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model: input.runtime.customModel,
        messages: custom_messages,
        temperature: 0.4,
      }),
    }) as custom_completion_response
    const content = response.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('Panel AI returned an empty response')
    return content.trim()
  }

  if (!CONFIG.panelAi.mistralApiKey.trim() || !CONFIG.panelAi.mistralPanelAgentId.trim()) {
    throw new Error('Mistral Panel Agent is not configured')
  }

  const client = new Mistral({ apiKey: CONFIG.panelAi.mistralApiKey })
  const instructions = build_mistral_instructions(input.context)
  const conversation = await client.beta.conversations.start({
    agentId: CONFIG.panelAi.mistralPanelAgentId,
    inputs: input.messages.map((message) => ({
      object: 'entry' as const,
      type: 'message.input' as const,
      role: message.role,
      content: message.content,
      prefix: false,
    })),
    instructions,
    store: false,
  })
  const content = extract_mistral_text((conversation as { outputs?: unknown }).outputs)
  if (!content) throw new Error('Panel AI returned an empty response')
  return content
}

export async function test_panel_ai_runtime(runtime: panel_ai_runtime) {
  if (runtime.provider === 'custom') {
    if (!runtime.customModel) throw new Error('Custom Provider model is not configured')
    return test_custom_provider_model(runtime.customModel)
  }
  const startedAt = Date.now()
  await complete_panel_ai({
    runtime,
    persona: '',
    context: '',
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  })
  return { model: 'agent', latencyMs: Date.now() - startedAt }
}
