import assert from 'node:assert/strict'
import test from 'node:test'

import {
  apply_ai_prompt_path_aliases,
  parse_env_boolean,
  parse_env_csv,
  parse_env_int,
  parse_env_port,
  parse_env_positive_int,
} from './env'

test('generic AI prompt variables override the legacy aliases', () => {
  const env: NodeJS.ProcessEnv = {
    DISCORD_AI_SYSTEM_PROMPT_PATH: ' /app/prompts/system_prompt.txt ',
    MISTRAL_PROMPT_PATH: '/legacy/discord.txt',
    PANEL_AI_SYSTEM_PROMPT_PATH: ' /app/prompts/panel_ai_system_prompt.txt ',
    PANEL_AI_PROMPT_PATH: '/legacy/panel.txt',
  }

  apply_ai_prompt_path_aliases(env)

  assert.equal(env.MISTRAL_PROMPT_PATH, '/app/prompts/system_prompt.txt')
  assert.equal(env.PANEL_AI_PROMPT_PATH, '/app/prompts/panel_ai_system_prompt.txt')
})

test('legacy prompt variables remain unchanged when generic variables are absent', () => {
  const env: NodeJS.ProcessEnv = {
    MISTRAL_PROMPT_PATH: '/legacy/discord.txt',
    PANEL_AI_PROMPT_PATH: '/legacy/panel.txt',
  }

  apply_ai_prompt_path_aliases(env)

  assert.equal(env.MISTRAL_PROMPT_PATH, '/legacy/discord.txt')
  assert.equal(env.PANEL_AI_PROMPT_PATH, '/legacy/panel.txt')
})


test('strict env integer parsing rejects partial, decimal, unsafe, and out-of-range values', () => {
  assert.equal(parse_env_int('123', 7), 123)
  assert.equal(parse_env_int('123abc', 7), 7)
  assert.equal(parse_env_int('1.5', 7), 7)
  assert.equal(parse_env_int('9007199254740992', 7), 7)
  assert.equal(parse_env_int('-1', 7, { min: 0 }), 7)
  assert.equal(parse_env_positive_int('0', 9, 100), 9)
  assert.equal(parse_env_positive_int('101', 9, 100), 9)
})

test('strict env boolean parsing recognizes both directions and preserves fallback on garbage', () => {
  assert.equal(parse_env_boolean('YES', false), true)
  assert.equal(parse_env_boolean('off', true), false)
  assert.equal(parse_env_boolean('garbage', true), true)
  assert.equal(parse_env_boolean(undefined, false), false)
})

test('env port and csv parsing are bounded and normalized', () => {
  assert.equal(parse_env_port('65535', 3000), 65535)
  assert.equal(parse_env_port('65536', 3000), 3000)
  assert.equal(parse_env_port('3000oops', 4000), 4000)
  assert.deepEqual(parse_env_csv(' one, two ,,three '), ['one', 'two', 'three'])
})
