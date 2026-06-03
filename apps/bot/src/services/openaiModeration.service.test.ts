import test from 'node:test'
import assert from 'node:assert/strict'

import {
  infer_openai_moderation_image_mime_type,
  normalize_openai_moderation_image_url,
} from './openaiModeration.service'

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

test('infer_openai_moderation_image_mime_type: uses content-type or URL hints', () => {
  assert.equal(
    infer_openai_moderation_image_mime_type('https://cdn.discordapp.com/image', 'image/png; charset=binary'),
    'image/png'
  )
  assert.equal(
    infer_openai_moderation_image_mime_type('https://cdn.discordapp.com/image?format=webp'),
    'image/webp'
  )
  assert.equal(
    infer_openai_moderation_image_mime_type('https://cdn.discordapp.com/image.txt', 'text/plain'),
    null
  )
})
