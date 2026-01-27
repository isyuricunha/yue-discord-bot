import test from 'node:test'
import assert from 'node:assert/strict'

import { generate_public_id } from '../public_id'

test('generate_public_id: returns expected length and charset', () => {
  const id = generate_public_id(12)
  assert.equal(id.length, 12)
  assert.match(id, /^[1-9A-HJ-NP-Za-km-z]+$/)
})

test('generate_public_id: generates different values across calls', () => {
  const ids = new Set<string>()
  for (let i = 0; i < 50; i += 1) {
    ids.add(generate_public_id(10))
  }
  assert.equal(ids.size, 50)
})
