import test from 'node:test'
import assert from 'node:assert/strict'

import { normalize_openai_moderation_image_url } from './openaiModeration.service'

test('normalize_openai_moderation_image_url: trims and strips trailing &/?', () => {
  assert.equal(
    normalize_openai_moderation_image_url(' https://cdn.discordapp.com/a.png? '),
    'https://cdn.discordapp.com/a.png'
  )
  assert.equal(
    normalize_openai_moderation_image_url('https://cdn.discordapp.com/a.png&'),
    'https://cdn.discordapp.com/a.png'
  )
  assert.equal(
    normalize_openai_moderation_image_url('https://cdn.discordapp.com/a.png&&&&'),
    'https://cdn.discordapp.com/a.png'
  )
})

test('normalize_openai_moderation_image_url: rejects non-http(s) protocols', () => {
  assert.equal(normalize_openai_moderation_image_url('data:image/png;base64,abc'), null)
  assert.equal(normalize_openai_moderation_image_url('ftp://example.com/a.png'), null)
})

test('normalize_openai_moderation_image_url: rejects invalid and empty values', () => {
  assert.equal(normalize_openai_moderation_image_url(''), null)
  assert.equal(normalize_openai_moderation_image_url('   '), null)
  assert.equal(normalize_openai_moderation_image_url('not a url'), null)
})
