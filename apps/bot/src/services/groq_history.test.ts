import test from 'node:test'
import assert from 'node:assert/strict'

import { build_history_for_prompt } from './groq_history'

test('groq_history: builds history preserving roles and trimming content', () => {
  const history = build_history_for_prompt([
    { role: 'user', content: '  hi  ' },
    { role: 'assistant', content: ' ok ' },
    { role: 'user', content: '   ' },
  ])

  assert.deepEqual(history, [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'ok' },
  ])
})
