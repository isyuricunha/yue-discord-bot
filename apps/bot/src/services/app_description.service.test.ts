import test from 'node:test'
import assert from 'node:assert/strict'

import { normalize_app_description_body } from './app_description.service'

test('app_description: rejects non-object body', () => {
  assert.equal(normalize_app_description_body(null), null)
  assert.equal(normalize_app_description_body('x'), null)
})

test('app_description: normalizes and trims description', () => {
  const parsed = normalize_app_description_body({ appDescription: '  hello  ' })
  assert.deepEqual(parsed, { appDescription: 'hello' })
})

test('app_description: empty description becomes null', () => {
  const parsed = normalize_app_description_body({ appDescription: '   ' })
  assert.deepEqual(parsed, { appDescription: null })
})
