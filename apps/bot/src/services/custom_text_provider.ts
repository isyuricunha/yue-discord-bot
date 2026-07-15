import {
  custom_provider_endpoint,
  build_custom_provider_payload,
  extract_custom_provider_text,
  type custom_provider_reasoning_mode,
} from '@yuebot/shared';
import { build_text_only_contract } from './yue_persona';

export function get_discord_ai_chat_timeout_ms(): number {
  const envValue = process.env.DISCORD_AI_CHAT_TIMEOUT_MS;
  if (!envValue) return 90000;
  const trimmed = envValue.trim();
  if (!/^\d+$/.test(trimmed)) return 90000;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 300000) return 90000;
  return parsed;
}

export type custom_text_completion_input = {
  user_prompt: string;
  model: string;
  reasoning_mode: custom_provider_reasoning_mode;
  capability: 'text' | 'image_generation' | 'web_search';
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
};

export type custom_text_completion_result = {
  content: string;
};

export async function request_json(url: string, init: RequestInit, timeout_ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(`failed`);
    }
    return body;
  } catch {
      throw new Error(`Custom Provider text chat failed`);
  } finally {
    clearTimeout(timeout);
  }
}

export class CustomTextProvider {
  constructor(
    private readonly deps: {
      base_url: string;
      api_key: string;
      fetch_json: typeof request_json;
      timeout_ms: number;
      system_prompt: () => Promise<string>;
    }
  ) {}

  async create_text_completion(
    input: custom_text_completion_input
  ): Promise<custom_text_completion_result> {
    const trimmed_prompt = input.user_prompt.trim();
    if (!trimmed_prompt) {
      throw new Error('Custom text chat missing natural prompt');
    }

    const trimmed_model = input.model.trim();
    if (!trimmed_model) {
      throw new Error('Custom text chat missing model');
    }

    const endpoint = custom_provider_endpoint(this.deps.base_url, '/chat/completions');
    if (!endpoint) {
      throw new Error('Custom Provider is not configured or has an invalid URL.');
    }

    const messages = [];

    const persona = await this.deps.system_prompt();
    if (persona) {
        messages.push({ role: 'system', content: persona });
    }
    messages.push({ role: 'system', content: build_text_only_contract(input.capability) });

    if (input.history) {
      for (const msg of input.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: trimmed_prompt });

    const payload = build_custom_provider_payload({
      model: trimmed_model,
      messages,
      reasoningMode: input.reasoning_mode,
    });

    const key = this.deps.api_key.trim();
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (key) {
      headers.authorization = `Bearer ${key}`;
    }

    let response;
    try {
        response = await this.deps.fetch_json(
          endpoint,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
          this.deps.timeout_ms
        );
    } catch {
        throw new Error('Custom Provider text chat failed');
    }

    const content = extract_custom_provider_text(response);
    if (!content) {
      throw new Error('Custom Provider text chat failed');
    }

    return { content };
  }
}
