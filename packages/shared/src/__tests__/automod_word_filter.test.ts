import test from 'node:test'
import assert from 'node:assert/strict'

import { find_first_banned_word_match } from '../automod_word_filter'

test('automod word filter: whole-word avoids substring false positive', () => {
  const rules = [{ word: 'ass', action: 'delete' }]

  assert.equal(find_first_banned_word_match('class', rules), null)
  assert.equal(find_first_banned_word_match('classic', rules), null)
  assert.ok(find_first_banned_word_match('ass', rules))
  assert.ok(find_first_banned_word_match('ass!', rules))
  assert.ok(find_first_banned_word_match('ASS', rules))
})

test('automod word filter: regex rule via re: prefix', () => {
  const rules = [{ word: 're:ass$', action: 'delete' }]

  assert.ok(find_first_banned_word_match('bad ass', rules))
  assert.equal(find_first_banned_word_match('bad assassin', rules), null)
})

test('automod word filter: /pattern/flags syntax', () => {
  const rules = [{ word: '/a+s+/', action: 'delete' }]

  assert.ok(find_first_banned_word_match('aaasss', rules))
  assert.equal(find_first_banned_word_match('bbb', rules), null)
})
