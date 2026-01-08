import test from 'node:test'
import assert from 'node:assert/strict'

import { normalize_presence_body } from './presence.service'

test('presence: rejects non-object body', () => {
  assert.equal(normalize_presence_body(null), null)
  assert.equal(normalize_presence_body('x'), null)
  assert.equal(normalize_presence_body(123), null)
})

test('presence: requires presenceEnabled boolean', () => {
  assert.equal(normalize_presence_body({}), null)
  assert.equal(normalize_presence_body({ presenceEnabled: 'true' }), null)
})

test('presence: defaults invalid status to online', () => {
  const parsed = normalize_presence_body({ presenceEnabled: true, presenceStatus: 'bad' })
  assert.ok(parsed)
  assert.equal(parsed.presenceStatus, 'online')
})

test('presence: normalizes activity fields and trims', () => {
  const parsed = normalize_presence_body({
    presenceEnabled: true,
    presenceStatus: 'idle',
    activityType: 'playing',
    activityName: '  hello  ',
    activityUrl: '  https://example.com  ',
  })

  assert.ok(parsed)
  assert.equal(parsed.presenceEnabled, true)
  assert.equal(parsed.presenceStatus, 'idle')
  assert.equal(parsed.activityType, 'playing')
  assert.equal(parsed.activityName, 'hello')
  assert.equal(parsed.activityUrl, 'https://example.com/')
})

test('presence: rejects streaming with name but without url', () => {
  const parsed = normalize_presence_body({
    presenceEnabled: true,
    presenceStatus: 'online',
    activityType: 'streaming',
    activityName: 'live now',
  })

  assert.equal(parsed, null)
})

test('presence: accepts streaming with url', () => {
  const parsed = normalize_presence_body({
    presenceEnabled: true,
    presenceStatus: 'online',
    activityType: 'streaming',
    activityName: 'live now',
    activityUrl: 'https://twitch.tv/example',
  })

  assert.ok(parsed)
  assert.equal(parsed.activityType, 'streaming')
  assert.equal(parsed.activityUrl, 'https://twitch.tv/example')
})
