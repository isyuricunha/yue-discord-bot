import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mistral_categories,
  mistral_to_openai_categories,
  openai_categories,
} from './automod.ai_categories'

test('mistral mapping: covers every Mistral category key', () => {
  for (const category of mistral_categories) {
    assert.ok(category in mistral_to_openai_categories, `missing mapping for ${category}`)
  }
  assert.equal(Object.keys(mistral_to_openai_categories).length, mistral_categories.length)
})

test('mistral mapping: targets are valid OpenAI categories', () => {
  for (const targets of Object.values(mistral_to_openai_categories)) {
    if (!targets) continue
    for (const target of targets) {
      assert.ok(
        (openai_categories as readonly string[]).includes(target),
        `${target} is not an OpenAI category`
      )
    }
  }
})

test('mistral mapping: categories without a Yue equivalent are null', () => {
  assert.equal(mistral_to_openai_categories.health, null)
  assert.equal(mistral_to_openai_categories.financial, null)
  assert.equal(mistral_to_openai_categories.law, null)
  assert.equal(mistral_to_openai_categories.pii, null)
})

test('mistral mapping: shared concepts map to OpenAI taxonomy', () => {
  assert.deepEqual(mistral_to_openai_categories.sexual, ['sexual'])
  assert.deepEqual(mistral_to_openai_categories.selfharm, ['self-harm'])
  // Mistral merges hate/discrimination and violence/threats: one Mistral
  // category covers both related OpenAI categories.
  assert.deepEqual(mistral_to_openai_categories.hate_and_discrimination, ['hate', 'harassment'])
  assert.deepEqual(mistral_to_openai_categories.violence_and_threats, ['violence', 'harassment/threatening'])
  assert.deepEqual(mistral_to_openai_categories.dangerous_and_criminal_content, ['illicit'])
})
