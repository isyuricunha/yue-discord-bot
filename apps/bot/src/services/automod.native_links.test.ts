import test from 'node:test'
import assert from 'node:assert/strict'

import {
  NATIVE_ALL_LINKS_REGEX,
  build_native_blocked_domain_patterns,
  build_native_blocked_domain_regex,
  can_sync_native_link_rule,
} from './automod.native_links'

test('native link regex matches exact domains and subdomains', () => {
  const source = build_native_blocked_domain_regex('steamgifts.com')
  assert.ok(source)

  const regex = new RegExp(source, 'i')
  assert.equal(regex.test('https://steamgifts.com/giveaway'), true)
  assert.equal(regex.test('Visit gifts.steamgifts.com/path'), true)
  assert.equal(regex.test('steamgifts.com'), true)
})

test('native link regex rejects hostname suffix lookalikes', () => {
  const source = build_native_blocked_domain_regex('steamgifts.com')
  assert.ok(source)

  const regex = new RegExp(source, 'i')
  assert.equal(regex.test('https://notsteamgifts.com/path'), false)
  assert.equal(regex.test('https://steamgifts.com.attacker.test/path'), false)
  assert.equal(regex.test('https://safe.example/path/steamgifts.com'), false)
  assert.equal(regex.test('Contact abuse@steamgifts.com'), false)
})

test('native all-links regex ignores email addresses', () => {
  const regex = new RegExp(NATIVE_ALL_LINKS_REGEX, 'i')
  assert.equal(regex.test('Visit https://example.com/path'), true)
  assert.equal(regex.test('Visit example.com/path'), true)
  assert.equal(regex.test('Contact test@example.com'), false)
})

test('native blocked-domain patterns normalize, deduplicate, and respect Discord limits', () => {
  const domains = Array.from({ length: 12 }, (_, index) => `domain-${index}.example.com`)
  const patterns = build_native_blocked_domain_patterns([
    'https://www.example.com/path',
    '*.example.com',
    ...domains,
  ])

  assert.equal(patterns.length, 10)
  assert.equal(patterns[0], build_native_blocked_domain_regex('example.com'))
})

test('native link rules are disabled when trusted domains require exact matching', () => {
  assert.equal(can_sync_native_link_rule([]), true)
  assert.equal(can_sync_native_link_rule(['discord.com']), false)
})
