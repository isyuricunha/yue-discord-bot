import assert from 'node:assert/strict'
import test from 'node:test'

import { apply_ai_prompt_path_aliases } from './env'

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
