import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clean_giveaway_item_label,
  match_giveaway_choices,
  normalize_giveaway_item_label,
  parse_giveaway_items_input,
} from '../giveaway_items'

test('clean_giveaway_item_label: trims and removes zero-width and collapses whitespace', () => {
  const raw = '  Cirurgia\u200B   do\u00a0Black  \r\n'
  assert.equal(clean_giveaway_item_label(raw), 'Cirurgia do Black')
})

test('normalize_giveaway_item_label: lowercases after cleaning', () => {
  assert.equal(normalize_giveaway_item_label('  A\u200B  '), 'a')
})

test('parse_giveaway_items_input: supports comma and newline separation, removes numbering and bullets', () => {
  const parsed = parse_giveaway_items_input('1. A, 2) B\n- C\n• D')
  assert.deepEqual(parsed, ['A', 'B', 'C', 'D'])
})

test('parse_giveaway_items_input: de-duplicates items case-insensitively after normalization', () => {
  const parsed = parse_giveaway_items_input('A\n a \nA\u200B')
  assert.deepEqual(parsed, ['A'])
})

test('match_giveaway_choices: resolves choices to canonical item casing and detects invalid ones', () => {
  const availableItems = ['Anal do Void', 'Cu do Zilion', 'Cirurgia do Black']

  const { invalid, resolved } = match_giveaway_choices({
    availableItems,
    choices: ['cirurgia\u200B do black', 'Nao existe'],
  })

  assert.deepEqual(resolved, ['Cirurgia do Black'])
  assert.deepEqual(invalid, ['Nao existe'])
})
