import { describe, expect, test } from 'vitest'
import { normalizeApiUrl } from './env'

describe('normalizeApiUrl', () => {
  test('keeps host base as-is', () => {
    expect(normalizeApiUrl('https://example.com')).toBe('https://example.com')
  })

  test('trims trailing slashes', () => {
    expect(normalizeApiUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeApiUrl('https://example.com////')).toBe('https://example.com')
  })

  test('strips a trailing /api segment', () => {
    expect(normalizeApiUrl('https://example.com/api')).toBe('https://example.com')
    expect(normalizeApiUrl('https://example.com/api/')).toBe('https://example.com')
    expect(normalizeApiUrl('https://example.com/api////')).toBe('https://example.com')
  })

  test('keeps empty string (same-origin)', () => {
    expect(normalizeApiUrl('')).toBe('')
  })
})
