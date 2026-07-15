import test from 'node:test';
import assert from 'node:assert/strict';
import { askCommand } from './ask';
import { reset_llm_client_singleton_for_tests, get_llm_client } from '../../services/llm_client_singleton';
import { create_llm_client_for_tests, DiscordAiUnavailableError } from '../../services/llm_client';

test('askCommand handles Custom fallback success without model/provider exposure', async () => {
  let repliedContent = '';
  let deferred = false;

  const mockInteraction: any = {
    options: {
      getString: () => 'What is the capital of France?',
    },
    deferReply: async () => { deferred = true; },
    editReply: async (payload: any) => { repliedContent = payload.content; },
    followUp: async () => {},
  };

  // Mock get_llm_client using singleton bypass or test client setup
  const mockClient = create_llm_client_for_tests({
    mistral: {
      create_completion: async () => { throw new Error('Mistral 429'); },
    },
    customTextProvider: {
      create_text_completion: async () => ({ content: 'Paris is the capital of France.' }),
    },
  });

  // Inject mock client
  const origEnv = process.env.CUSTOM_PROVIDER_BASE_URL;
  process.env.CUSTOM_PROVIDER_BASE_URL = 'http://localhost:8080';
  reset_llm_client_singleton_for_tests();

  try {
    await askCommand.execute(mockInteraction);
    assert.equal(deferred, true);
    assert.ok(repliedContent.includes('Paris is the capital of France.'));
    assert.equal(repliedContent.includes('custom'), false);
    assert.equal(repliedContent.includes('mistral'), false);
    assert.equal(repliedContent.includes('opaque'), false);
  } finally {
    if (origEnv !== undefined) process.env.CUSTOM_PROVIDER_BASE_URL = origEnv;
    else delete process.env.CUSTOM_PROVIDER_BASE_URL;
    reset_llm_client_singleton_for_tests();
  }
});

test('askCommand handles generic total failure gracefully without exposing raw secrets', async () => {
  let repliedContent = '';

  const mockInteraction: any = {
    options: {
      getString: () => 'What is 2+2?',
    },
    deferReply: async () => {},
    editReply: async (payload: any) => { repliedContent = payload.content; },
  };

  process.env.CUSTOM_PROVIDER_BASE_URL = 'http://localhost:8080';
  reset_llm_client_singleton_for_tests();

  try {
    await askCommand.execute(mockInteraction);
    assert.ok(repliedContent.includes('Erro inesperado') || repliedContent.includes('IA não autorizada') || repliedContent.includes('Erro ao consultar IA'));
    assert.equal(repliedContent.includes('SECRET_API_KEY'), false);
  } finally {
    delete process.env.CUSTOM_PROVIDER_BASE_URL;
    reset_llm_client_singleton_for_tests();
  }
});
