import test from 'node:test';
import assert from 'node:assert/strict';
import { CustomTextProvider, get_discord_ai_chat_timeout_ms } from './custom_text_provider';
import type { custom_text_completion_input } from './custom_text_provider';
import type { custom_provider_reasoning_mode } from '@yuebot/shared';

test('get_discord_ai_chat_timeout_ms normalizes invalid, missing, boundary, and non-numeric values', () => {
  const orig = process.env.DISCORD_AI_CHAT_TIMEOUT_MS;
  try {
    delete process.env.DISCORD_AI_CHAT_TIMEOUT_MS;
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '  ';
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = 'invalid_number';
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '90000abc';
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '0';
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '-500';
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '500'; // lower than 1000 min
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '500000'; // higher than 300000 max
    assert.equal(get_discord_ai_chat_timeout_ms(), 90000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '1000'; // min bound
    assert.equal(get_discord_ai_chat_timeout_ms(), 1000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '300000'; // max bound
    assert.equal(get_discord_ai_chat_timeout_ms(), 300000);

    process.env.DISCORD_AI_CHAT_TIMEOUT_MS = '60000';
    assert.equal(get_discord_ai_chat_timeout_ms(), 60000);
  } finally {
    if (orig !== undefined) process.env.DISCORD_AI_CHAT_TIMEOUT_MS = orig;
    else delete process.env.DISCORD_AI_CHAT_TIMEOUT_MS;
  }
});

test('CustomTextProvider system-message order, history order, exact opaque model, and text completion success', async () => {
  let capturedUrl = '';
  let capturedInit: any = null;
  let capturedTimeout = 0;

  const mockFetchJson = async (url: string, init: RequestInit, timeout: number) => {
    capturedUrl = url;
    capturedInit = init;
    capturedTimeout = timeout;
    return {
      choices: [{ message: { content: 'This is the answer' } }],
    };
  };

  const provider = new CustomTextProvider({
    base_url: 'https://api.openai.com/v1/',
    api_key: 'sk-test-secret-key',
    fetch_json: mockFetchJson as any,
    timeout_ms: 12000,
    system_prompt: async () => 'Yue Persona Custom Prompt',
  });

  const input: custom_text_completion_input = {
    user_prompt: 'Current User Question',
    model: 'opaque-org/custom-model-id',
    reasoning_mode: 'high',
    capability: 'text',
    history: [
      { role: 'user', content: 'Prev Question' },
      { role: 'assistant', content: 'Prev Answer' },
    ],
  };

  const result = await provider.create_text_completion(input);
  assert.equal(result.content, 'This is the answer');
  assert.equal(capturedUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(capturedInit.headers.authorization, 'Bearer sk-test-secret-key');
  assert.equal(capturedTimeout, 12000);

  const payload = JSON.parse(capturedInit.body);
  assert.equal(payload.model, 'opaque-org/custom-model-id');
  assert.equal(payload.reasoning_effort, 'high');
  assert.equal(payload.messages.length, 5);

  // Exact system message order:
  // 1: Persona
  // 2: Mandatory Code Contract
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[0].content, 'Yue Persona Custom Prompt');

  assert.equal(payload.messages[1].role, 'system');
  assert.ok(payload.messages[1].content.includes('You are Yue.'));
  assert.ok(payload.messages[1].content.includes('operating in text-only mode'));

  // History preservation order:
  assert.equal(payload.messages[2].role, 'user');
  assert.equal(payload.messages[2].content, 'Prev Question');

  assert.equal(payload.messages[3].role, 'assistant');
  assert.equal(payload.messages[3].content, 'Prev Answer');

  // Current natural user prompt:
  assert.equal(payload.messages[4].role, 'user');
  assert.equal(payload.messages[4].content, 'Current User Question');
});

test('CustomTextProvider handles all 6 reasoning modes correctly and omits reasoning_effort when omit', async () => {
  const modes: custom_provider_reasoning_mode[] = ['omit', 'none', 'minimal', 'low', 'medium', 'high'];

  for (const mode of modes) {
    let capturedBody: any = null;
    const provider = new CustomTextProvider({
      base_url: 'http://localhost:8080/v1',
      api_key: '',
      fetch_json: async (_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return { choices: [{ message: { content: 'ok' } }] };
      },
      timeout_ms: 5000,
      system_prompt: async () => '',
    });

    await provider.create_text_completion({
      user_prompt: 'hi',
      model: 'test-model',
      reasoning_mode: mode,
      capability: 'text',
    });

    if (mode === 'omit') {
      assert.equal(Object.hasOwn(capturedBody, 'reasoning_effort'), false);
    } else {
      assert.equal(capturedBody.reasoning_effort, mode);
    }
  }
});

test('CustomTextProvider validation errors: missing prompt, missing model, invalid URL, malformed response', async () => {
  const provider = new CustomTextProvider({
    base_url: 'https://api.test.com',
    api_key: '',
    fetch_json: async () => ({ choices: [] }),
    timeout_ms: 5000,
    system_prompt: async () => '',
  });

  await assert.rejects(
    () => provider.create_text_completion({ user_prompt: '  ', model: 'm', reasoning_mode: 'omit', capability: 'text' }),
    /missing natural prompt/
  );

  await assert.rejects(
    () => provider.create_text_completion({ user_prompt: 'hi', model: '  ', reasoning_mode: 'omit', capability: 'text' }),
    /missing model/
  );

  const invalidUrlProvider = new CustomTextProvider({
    base_url: 'invalid_url',
    api_key: '',
    fetch_json: async () => ({}),
    timeout_ms: 5000,
    system_prompt: async () => '',
  });

  await assert.rejects(
    () => invalidUrlProvider.create_text_completion({ user_prompt: 'hi', model: 'm', reasoning_mode: 'omit', capability: 'text' }),
    /[Ii]nvalid URL/
  );

  await assert.rejects(
    () => provider.create_text_completion({ user_prompt: 'hi', model: 'm', reasoning_mode: 'omit', capability: 'text' }),
    /empty response/
  );
});
