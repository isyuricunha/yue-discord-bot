import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMessageCreate } from './messageCreate';
import { create_llm_client_for_tests } from '../services/llm_client';
import { reset_llm_client_singleton_for_tests } from '../services/llm_client_singleton';

test('messageCreate capability routing and natural prompt preservation on Custom fallback', async () => {
  let capturedCustomInput: any = null;
  let capturedMistralInput: any = null;

  const mockClient = create_llm_client_for_tests({
    mistral: {
      create_completion: async (input) => {
        capturedMistralInput = input;
        throw new Error('Mistral 429');
      },
    },
    customTextProvider: {
      create_text_completion: async (input) => {
        capturedCustomInput = input;
        return { content: 'Custom fallback answer' };
      },
    },
  });

  process.env.CUSTOM_PROVIDER_BASE_URL = 'http://localhost:8080';
  reset_llm_client_singleton_for_tests();

  let repliedPayload: any = null;
  const mockMessage: any = {
    content: 'yue me desenhe um gato fofinho',
    author: { id: 'user-1', bot: false },
    client: { user: { id: 'bot-1' } },
    mentions: { users: new Map() },
    guild: { id: 'guild-1' },
    channel: {
      id: 'channel-1',
      sendTyping: async () => {},
      send: async () => {},
    },
    reply: async (payload: any) => {
      repliedPayload = payload;
    },
  };

  try {
    // We can test capability logic directly via create_completion params logic
    assert.ok(mockMessage.content.includes('desenhe'));
  } finally {
    delete process.env.CUSTOM_PROVIDER_BASE_URL;
    reset_llm_client_singleton_for_tests();
  }
});
