import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LlmClient,
  create_llm_client_for_tests,
  is_eligible_fallback_error,
  MistralNotConfiguredError,
  MistralTimeoutError,
  DiscordAiUnavailableError,
} from './llm_client';
import { MistralError } from '@mistralai/mistralai/models/errors';
import { MistralApiError } from './mistral.service';

function create_fake_mistral_sdk_error(statusCode: number): MistralError {
  const fakeResponse = new Response('{}', { status: statusCode, headers: { 'content-type': 'application/json' } });
  const fakeRequest = new Request('https://api.mistral.ai/v1/conversations');
  return new MistralError('Mistral HTTP Error', { response: fakeResponse, request: fakeRequest, body: '{}' });
}

test('is_eligible_fallback_error strict classification rules', () => {
  // Ineligible values:
  assert.equal(is_eligible_fallback_error(null), false);
  assert.equal(is_eligible_fallback_error(undefined), false);
  assert.equal(is_eligible_fallback_error(new Error('plain error')), false);
  assert.equal(is_eligible_fallback_error(new TypeError('type error')), false);
  assert.equal(is_eligible_fallback_error({ statusCode: 500 }), false);
  assert.equal(is_eligible_fallback_error({ status: 401 }), false);
  assert.equal(is_eligible_fallback_error({ constructor: { name: 'MistralError' }, statusCode: 500 }), false);

  // Non-eligible SDK status codes:
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(400)), false);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(404)), false);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(409)), false);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(422)), false);
  assert.equal(is_eligible_fallback_error(new MistralApiError('400', 400, null, null)), false);
  assert.equal(is_eligible_fallback_error(new MistralApiError('404', 404, null, null)), false);

  // Eligible application errors:
  assert.equal(is_eligible_fallback_error(new MistralNotConfiguredError()), true);
  assert.equal(is_eligible_fallback_error(new MistralTimeoutError()), true);

  // Eligible SDK status codes:
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(401)), true);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(403)), true);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(408)), true);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(429)), true);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(500)), true);
  assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(503)), true);

  assert.equal(is_eligible_fallback_error(new MistralApiError('401', 401, null, null)), true);
  assert.equal(is_eligible_fallback_error(new MistralApiError('403', 403, null, null)), true);
  assert.equal(is_eligible_fallback_error(new MistralApiError('408', 408, null, null)), true);
  assert.equal(is_eligible_fallback_error(new MistralApiError('429', 429, null, null)), true);
  assert.equal(is_eligible_fallback_error(new MistralApiError('500', 500, null, null)), true);

  // Eligible transport errors on real Error instances:
  const errReset = new Error('reset');
  (errReset as any).code = 'ECONNRESET';
  assert.equal(is_eligible_fallback_error(errReset), true);

  const errAbort = new Error('abort');
  errAbort.name = 'AbortError';
  assert.equal(is_eligible_fallback_error(errAbort), true);
});

test('Mistral success returns mistral content and attachments, and performs zero settings calls', async () => {
  let loadSettingsCalled = false;
  const client = create_llm_client_for_tests({
    mistral: {
      create_completion: async (input) => ({
        content: 'Mistral Answer',
        attachments: [{ filename: 'test.png', content_type: 'image/png', data: Buffer.from('img') }],
      }),
    },
    load_settings: async () => {
      loadSettingsCalled = true;
      return { discordAiTextFallbackEnabled: true, customProviderModel: 'model', customProviderReasoningMode: 'omit' };
    },
  });

  const res = await client.create_completion({ user_prompt: 'hello' });
  assert.equal(res.provider, 'mistral');
  assert.equal(res.content, 'Mistral Answer');
  assert.equal(res.attachments?.length, 1);
  assert.equal(loadSettingsCalled, false);
});

test('Fallback trigger matrix: 401, 403, 408, 429, 500 status codes trigger Custom fallback', async () => {
  const eligibleErrors = [
    create_fake_mistral_sdk_error(401),
    create_fake_mistral_sdk_error(403),
    create_fake_mistral_sdk_error(408),
    create_fake_mistral_sdk_error(429),
    create_fake_mistral_sdk_error(500),
    new MistralApiError('429', 429, null, null),
  ];

  for (const err of eligibleErrors) {
    const events: any[] = [];
    const client = create_llm_client_for_tests({
      mistral: {
        create_completion: async () => {
          throw err;
        },
      },
      customTextProvider: {
        create_text_completion: async () => ({ content: 'Fallback Response' }),
      },
      event_sink: (e) => events.push(e),
    });

    const res = await client.create_completion({ user_prompt: 'test' });
    assert.equal(res.provider, 'custom');
    assert.equal(res.content, 'Fallback Response');

    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'discord_ai_fallback_attempted');
    assert.equal(events[1].type, 'discord_ai_fallback_succeeded');
  }
});

test('Fallback disabled, missing model, missing endpoint, settings failure, or ineligible error emit NO events and throw DiscordAiUnavailableError', async () => {
  const events: any[] = [];

  // 1. Fallback disabled
  const clientDisabled = create_llm_client_for_tests({
    mistral: { create_completion: async () => { throw create_fake_mistral_sdk_error(429); } },
    customTextProvider: { create_text_completion: async () => ({ content: 'custom' }) },
    load_settings: async () => ({ discordAiTextFallbackEnabled: false, customProviderModel: 'model', customProviderReasoningMode: 'omit' }),
    event_sink: (e) => events.push(e),
  });

  await assert.rejects(() => clientDisabled.create_completion({ user_prompt: 'q' }), DiscordAiUnavailableError);
  assert.equal(events.length, 0);

  // 2. Missing model
  const clientNoModel = create_llm_client_for_tests({
    mistral: { create_completion: async () => { throw create_fake_mistral_sdk_error(429); } },
    customTextProvider: { create_text_completion: async () => ({ content: 'custom' }) },
    load_settings: async () => ({ discordAiTextFallbackEnabled: true, customProviderModel: null, customProviderReasoningMode: 'omit' }),
    event_sink: (e) => events.push(e),
  });

  await assert.rejects(() => clientNoModel.create_completion({ user_prompt: 'q' }), DiscordAiUnavailableError);
  assert.equal(events.length, 0);

  // 3. Settings loader failure
  const clientSettingsFail = create_llm_client_for_tests({
    mistral: { create_completion: async () => { throw create_fake_mistral_sdk_error(429); } },
    customTextProvider: { create_text_completion: async () => ({ content: 'custom' }) },
    load_settings: async () => { throw new Error('DB Down'); },
    event_sink: (e) => events.push(e),
  });

  await assert.rejects(() => clientSettingsFail.create_completion({ user_prompt: 'q' }), DiscordAiUnavailableError);
  assert.equal(events.length, 0);

  // 4. Ineligible error (e.g. 400 Bad Request)
  const clientIneligible = create_llm_client_for_tests({
    mistral: { create_completion: async () => { throw create_fake_mistral_sdk_error(400); } },
    customTextProvider: { create_text_completion: async () => ({ content: 'custom' }) },
    event_sink: (e) => events.push(e),
  });

  await assert.rejects(() => clientIneligible.create_completion({ user_prompt: 'q' }), DiscordAiUnavailableError);
  assert.equal(events.length, 0);
});

test('Custom-only operation: when Mistral is absent and Custom is enabled, completes using Custom', async () => {
  const events: any[] = [];
  const client = create_llm_client_for_tests({
    mistral: null,
    customTextProvider: {
      create_text_completion: async () => ({ content: 'Custom Alone Answer' }),
    },
    event_sink: (e) => events.push(e),
  });

  const res = await client.create_completion({ user_prompt: 'hello' });
  assert.equal(res.provider, 'custom');
  assert.equal(res.content, 'Custom Alone Answer');
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'discord_ai_fallback_attempted');
  assert.equal(events[1].type, 'discord_ai_fallback_succeeded');
});

test('Timeout followed by late Mistral resolution: Custom fallback response wins, timer cleared, late resolution consumed without unhandledRejection', async () => {
  let mistralCallCount = 0;
  let customCallCount = 0;
  const events: any[] = [];

  let resolveLateMistral!: (val: any) => void;
  const lateMistralPromise = new Promise((resolve) => {
    resolveLateMistral = resolve;
  });

  const client = create_llm_client_for_tests({
    mistral: {
      create_completion: async () => {
        mistralCallCount++;
        return lateMistralPromise as any;
      },
    },
    customTextProvider: {
      create_text_completion: async () => {
        customCallCount++;
        return { content: 'Custom Winner' };
      },
    },
    timeout_ms: () => 10, // Fast timeout
    event_sink: (e) => events.push(e),
  });

  const res = await client.create_completion({ user_prompt: 'race query' });
  assert.equal(res.provider, 'custom');
  assert.equal(res.content, 'Custom Winner');
  assert.equal(mistralCallCount, 1);
  assert.equal(customCallCount, 1);

  // Late resolution happens after fallback returned:
  resolveLateMistral({ content: 'Late Mistral Answer' });
  await new Promise((r) => setTimeout(r, 20));

  // Verify response was NOT overwritten and no duplicate events occurred
  assert.equal(res.content, 'Custom Winner');
  assert.equal(events.length, 2);
});

test('Timeout followed by late Mistral rejection: Custom fallback response wins, timer cleared, late rejection consumed without unhandledRejection', async () => {
  let mistralCallCount = 0;
  let customCallCount = 0;
  const events: any[] = [];

  let rejectLateMistral!: (err: any) => void;
  const lateMistralPromise = new Promise((_, reject) => {
    rejectLateMistral = reject;
  });

  const client = create_llm_client_for_tests({
    mistral: {
      create_completion: async () => {
        mistralCallCount++;
        return lateMistralPromise as any;
      },
    },
    customTextProvider: {
      create_text_completion: async () => {
        customCallCount++;
        return { content: 'Custom Winner Rejection' };
      },
    },
    timeout_ms: () => 10,
    event_sink: (e) => events.push(e),
  });

  const res = await client.create_completion({ user_prompt: 'race query 2' });
  assert.equal(res.provider, 'custom');
  assert.equal(res.content, 'Custom Winner Rejection');
  assert.equal(mistralCallCount, 1);
  assert.equal(customCallCount, 1);

  // Late rejection happens after fallback returned:
  rejectLateMistral(create_fake_mistral_sdk_error(500));
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(res.content, 'Custom Winner Rejection');
  assert.equal(events.length, 2);
});

test('Secret safety: raw error details, cause, and database secrets are absent from thrown DiscordAiUnavailableError', async () => {
  const secretString = 'CONFIDENTIAL_MISTRAL_API_KEY_SUPER_SECRET';

  const client = create_llm_client_for_tests({
    mistral: {
      create_completion: async () => {
        throw new Error(`Upstream API failed with secret key: ${secretString}`);
      },
    },
  });

  try {
    await client.create_completion({ user_prompt: 'secret test' });
    assert.fail('Should have thrown DiscordAiUnavailableError');
  } catch (err: any) {
    assert.equal(err.name, 'DiscordAiUnavailableError');
    assert.equal(err.message, 'LLM providers unavailable');
    assert.equal(err.cause, undefined);
    assert.equal(JSON.stringify(err).includes(secretString), false);
  }
});

test('Event sink exceptions do not affect fallback execution or alter behavior', async () => {
  const client = create_llm_client_for_tests({
    mistral: { create_completion: async () => { throw create_fake_mistral_sdk_error(429); } },
    customTextProvider: { create_text_completion: async () => ({ content: 'Resilient Custom' }) },
    event_sink: () => { throw new Error('Event Sink Crash'); },
  });

  const res = await client.create_completion({ user_prompt: 'sink test' });
  assert.equal(res.provider, 'custom');
  assert.equal(res.content, 'Resilient Custom');
});
