import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { load_custom_provider_system_prompt, reset_prompt_cache_for_tests, CUSTOM_PROVIDER_FALLBACK_PROMPT } from './prompt_loader'

const tmp_dir = join(tmpdir(), 'panel-ai-prompt-test')

test.before(() => {
  mkdirSync(tmp_dir, { recursive: true })
})

test.after(() => {
  rmSync(tmp_dir, { recursive: true, force: true })
})

test.beforeEach(() => {
  reset_prompt_cache_for_tests()
})

test('returns a provider-neutral fallback prompt when no path is configured', () => {
  const prompt = load_custom_provider_system_prompt('')
  assert.equal(prompt, CUSTOM_PROVIDER_FALLBACK_PROMPT)
  assert.ok(prompt.includes('configured panel assistant'))
  assert.ok(prompt.includes('Never invent'))
  assert.ok(prompt.includes('cannot confirm'))
  assert.equal(prompt.includes('Ella'), false)
  assert.equal(prompt.includes('Yue'), false)
})

test('loads a custom system prompt from file and caches it', () => {
  const file_path = join(tmp_dir, 'custom_prompt.txt')
  writeFileSync(file_path, 'You are the configured panel assistant.', 'utf-8')

  const first = load_custom_provider_system_prompt(file_path)
  const second = load_custom_provider_system_prompt(file_path)

  assert.equal(first, 'You are the configured panel assistant.')
  assert.equal(second, first, 'cached value must be identical')
})

test('returns the fallback when the file does not exist', () => {
  const prompt = load_custom_provider_system_prompt(join(tmp_dir, 'nonexistent_prompt.txt'))
  assert.equal(prompt, CUSTOM_PROVIDER_FALLBACK_PROMPT)
})

test('returns the fallback when the file is empty', () => {
  const file_path = join(tmp_dir, 'empty_prompt.txt')
  writeFileSync(file_path, '   \n\n  ', 'utf-8')

  const prompt = load_custom_provider_system_prompt(file_path)
  assert.equal(prompt, CUSTOM_PROVIDER_FALLBACK_PROMPT)
})
