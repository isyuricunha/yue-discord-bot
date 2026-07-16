import test from 'node:test';
import assert from 'node:assert/strict';
import { load_yue_persona, build_text_only_contract } from './yue_persona';

test('load_yue_persona returns default system prompt when file path is missing or invalid', async () => {
  const orig = process.env.MISTRAL_PROMPT_PATH;
  delete process.env.MISTRAL_PROMPT_PATH;

  try {
    const prompt = await load_yue_persona();
    assert.ok(prompt.includes('You are Yue'));
    assert.ok(prompt.includes('helpful Discord bot assistant'));
  } finally {
    if (orig) process.env.MISTRAL_PROMPT_PATH = orig;
  }
});

test('build_text_only_contract includes all 9 mandatory rules and identity guidelines', () => {
  const textContract = build_text_only_contract('text');
  assert.ok(textContract.includes('You are Yue.'));
  assert.ok(textContract.includes('Reply in the same language as the user.'));
  assert.ok(textContract.includes('operating in text-only mode'));
  assert.ok(textContract.includes('Never claim that web search was performed'));
  assert.ok(textContract.includes('Never claim that an image or file was generated'));
  assert.ok(textContract.includes('Never claim that a tool was executed'));
  assert.ok(textContract.includes('Never fabricate URLs, citations, sources'));
  assert.ok(textContract.includes('Never mention providers, models, fallback'));
  assert.ok(textContract.includes('explain the limitation naturally'));
});

test('build_text_only_contract injects capability-specific guidelines', () => {
  const imgContract = build_text_only_contract('image_generation');
  assert.ok(imgContract.includes('do not claim an image exists'));
  assert.ok(imgContract.includes('offer a description, concept, composition'));

  const webContract = build_text_only_contract('web_search');
  assert.ok(webContract.includes('do not claim live results were retrieved'));
  assert.ok(webContract.includes('do not fabricate fresh facts or source URLs'));
});
