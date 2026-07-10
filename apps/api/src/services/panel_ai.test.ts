import assert from 'node:assert/strict'
import test from 'node:test'

import { extract_mistral_text } from './panel_ai'

test('extracts text from a string content', () => {
  const outputs = [
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Hello from Ella' },
  ]
  assert.equal(extract_mistral_text(outputs), 'Hello from Ella')
})

test('extracts text from an array of typed chunks', () => {
  const outputs = [
    {
      object: 'entry',
      type: 'message.output',
      role: 'assistant',
      content: [
        { type: 'text', text: 'First paragraph' },
        { type: 'text', text: 'Second paragraph' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'First paragraph\nSecond paragraph')
})

test('extracts text from an array containing plain strings', () => {
  const outputs = [
    {
      object: 'entry',
      type: 'message.output',
      role: 'assistant',
      content: ['Chunk A', 'Chunk B'],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'Chunk A\nChunk B')
})

test('uses the last message.output when multiple outputs are present', () => {
  const outputs = [
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Old reply' },
    { object: 'entry', type: 'function_call', name: 'some_tool' },
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Latest reply' },
  ]
  assert.equal(extract_mistral_text(outputs), 'Latest reply')
})

test('returns empty string for invalid or empty responses', () => {
  assert.equal(extract_mistral_text(undefined), '')
  assert.equal(extract_mistral_text(null), '')
  assert.equal(extract_mistral_text('not an array'), '')
  assert.equal(extract_mistral_text([]), '')
  assert.equal(extract_mistral_text([{ type: 'function_call', name: 'tool' }]), '')
  assert.equal(
    extract_mistral_text([{ type: 'message.output', content: [{ type: 'image_url', image_url: 'x' }] }]),
    '',
  )
  assert.equal(extract_mistral_text([{ type: 'message.output', content: '' }]), '')
  assert.equal(extract_mistral_text([{ type: 'message.output', content: [] }]), '')
})

test('ignores non-text chunks within a mixed content array', () => {
  const outputs = [
    {
      type: 'message.output',
      content: [
        { type: 'think', think: 'internal reasoning' },
        { type: 'text', text: 'visible answer' },
        { type: 'tool_reference', tool_call_id: 'abc' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'visible answer')
})

test('accepts chunks with text when type is absent (SDK optional type)', () => {
  const outputs = [
    {
      type: 'message.output',
      content: [
        { text: 'visible answer' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'visible answer')
})
