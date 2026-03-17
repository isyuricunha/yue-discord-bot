import test from 'node:test'
import assert from 'node:assert/strict'

import { extract_ai_moderation_image_urls } from './automod.ai_images'

test('extract_ai_moderation_image_urls: includes image attachments by contentType', () => {
  const urls = extract_ai_moderation_image_urls({
    attachments: [
      { url: 'https://cdn.discordapp.com/a.png', contentType: 'image/png', name: 'a.png' },
    ],
    embeds: [],
  })

  assert.deepEqual(urls, ['https://cdn.discordapp.com/a.png'])
})

test('extract_ai_moderation_image_urls: includes image attachments by filename when contentType is missing', () => {
  const urls = extract_ai_moderation_image_urls({
    attachments: [
      { url: 'https://cdn.discordapp.com/a', contentType: null, name: 'photo.JPG' },
    ],
    embeds: [],
  })

  assert.deepEqual(urls, ['https://cdn.discordapp.com/a'])
})

test('extract_ai_moderation_image_urls: includes embed image url', () => {
  const urls = extract_ai_moderation_image_urls({
    attachments: [],
    embeds: [
      { imageUrl: 'https://example.com/embed.webp', thumbnailUrl: null },
    ],
  })

  assert.deepEqual(urls, ['https://example.com/embed.webp'])
})

test("extract_ai_moderation_image_urls: strips trailing '&' from urls", () => {
  const urls = extract_ai_moderation_image_urls({
    attachments: [
      { url: 'https://cdn.discordapp.com/a.png?x=1&', contentType: 'image/png', name: 'a.png' },
    ],
    embeds: [],
  })

  assert.deepEqual(urls, ['https://cdn.discordapp.com/a.png?x=1'])
})

test('extract_ai_moderation_image_urls: drops non-http(s) urls', () => {
  const urls = extract_ai_moderation_image_urls({
    attachments: [
      { url: 'ftp://example.com/a.png', contentType: 'image/png', name: 'a.png' },
      { url: 'https://cdn.discordapp.com/ok.png', contentType: 'image/png', name: 'ok.png' },
    ],
    embeds: [],
  })

  assert.deepEqual(urls, ['https://cdn.discordapp.com/ok.png'])
})

test('extract_ai_moderation_image_urls: de-duplicates and caps at 10', () => {
  const attachments = Array.from({ length: 20 }, (_, idx) => ({
    url: `https://cdn.discordapp.com/${idx}.png`,
    contentType: 'image/png',
    name: `${idx}.png`,
  }))

  const urls = extract_ai_moderation_image_urls({
    attachments,
    embeds: [
      { imageUrl: 'https://cdn.discordapp.com/0.png', thumbnailUrl: null },
      { imageUrl: 'https://cdn.discordapp.com/extra.png', thumbnailUrl: null },
    ],
  })

  assert.equal(urls.length, 10)
  assert.equal(urls[0], 'https://cdn.discordapp.com/0.png')
})
