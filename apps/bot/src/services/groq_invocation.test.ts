import test from 'node:test'
import assert from 'node:assert/strict'

import { build_user_prompt_from_invocation, contains_yue_keyword, remove_bot_mention } from './groq_invocation'

test('groq_invocation: matches yue keyword case-insensitive as word', () => {
  assert.equal(contains_yue_keyword('yue'), true)
  assert.equal(contains_yue_keyword('Yue'), true)
  assert.equal(contains_yue_keyword('hey yue!'), true)
  assert.equal(contains_yue_keyword('yuebot'), false)
  assert.equal(contains_yue_keyword('myue'), false)
})

test('groq_invocation: removes bot mention markup', () => {
  assert.equal(remove_bot_mention('<@123> hello', '123'), 'hello')
  assert.equal(remove_bot_mention('<@!123> hello', '123'), 'hello')
  assert.equal(remove_bot_mention('hi <@123> there', '123'), 'hi there')
})

test('groq_invocation: builds user prompt from mention or yue keyword', () => {
  assert.equal(
    build_user_prompt_from_invocation({ content: 'yue: oi', mentions_bot: false, bot_user_id: null }),
    'oi'
  )

  assert.equal(
    build_user_prompt_from_invocation({ content: '<@123> yue oi', mentions_bot: true, bot_user_id: '123' }),
    'oi'
  )

  assert.equal(
    build_user_prompt_from_invocation({ content: 'yue', mentions_bot: false, bot_user_id: null }),
    'Say hello.'
  )

  assert.equal(
    build_user_prompt_from_invocation({ content: 'hello', mentions_bot: false, bot_user_id: null }),
    null
  )
})
