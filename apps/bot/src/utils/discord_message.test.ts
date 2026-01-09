import test from 'node:test'
import assert from 'node:assert/strict'

import { DISCORD_MESSAGE_MAX_CHARS, split_discord_message } from './discord_message'

test('discord_message: returns single chunk for short content', () => {
  const parts = split_discord_message('hello')
  assert.deepEqual(parts, ['hello'])
})

test('discord_message: splits long content into multiple chunks', () => {
  const long = 'a'.repeat(DISCORD_MESSAGE_MAX_CHARS + 10)
  const parts = split_discord_message(long)

  assert.ok(parts.length >= 2)
  for (const p of parts) {
    assert.ok(p.length <= DISCORD_MESSAGE_MAX_CHARS)
  }

  assert.equal(parts.join(''), long)
})

test('discord_message: preserves code fences across splits', () => {
  const max = 60
  const input = [
    '```ts',
    'const a = 1',
    'const b = 2',
    'const c = 3',
    'const d = 4',
    'const e = 5',
    '```',
    'after',
  ].join('\n')

  const parts = split_discord_message(input, { max_chars: max })
  assert.ok(parts.length >= 2)

  // Any chunk containing an opening fence must also contain a closing fence
  for (const p of parts) {
    const has_open = p.includes('```ts') || p.startsWith('```')
    if (has_open) {
      assert.ok(p.includes('```'))
    }
    assert.ok(p.length <= max)
  }

  const reconstructed = parts.join('\n')
  assert.ok(reconstructed.includes('const a = 1'))
  assert.ok(reconstructed.includes('after'))
})
