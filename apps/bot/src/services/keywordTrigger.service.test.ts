import test from 'node:test'
import assert from 'node:assert/strict'

import { build_remove_trigger_where } from './keywordTrigger.service'

test('build_remove_trigger_where matches legacy and multi-keyword triggers', () => {
  assert.deepEqual(build_remove_trigger_where('guild-1', '  Hello  '), {
    guildId: 'guild-1',
    OR: [
      { keyword: 'hello' },
      { keywords: { has: 'hello' } },
    ],
  })
})
