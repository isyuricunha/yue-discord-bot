import { describe, expect, test } from 'vitest'

import { validate_timeout_duration } from './duration'

describe('validate_timeout_duration', () => {
  test('rejects empty', () => {
    expect(validate_timeout_duration('')).toMatchObject({ error: expect.any(String), ms: null })
  })

  test('rejects invalid format', () => {
    expect(validate_timeout_duration('5')).toMatchObject({ error: expect.any(String), ms: null })
    expect(validate_timeout_duration('0m')).toMatchObject({ error: expect.any(String), ms: null })
    expect(validate_timeout_duration('5minutes')).toMatchObject({ error: expect.any(String), ms: null })
  })

  test('normalizes casing', () => {
    expect(validate_timeout_duration(' 5M ')).toMatchObject({ normalized: '5m', error: null, ms: 300000 })
  })

  test('rejects durations beyond discord max timeout', () => {
    const res = validate_timeout_duration('29d')
    expect(res.error).toBeTruthy()
    expect(res.ms).toBe(29 * 24 * 60 * 60 * 1000)
  })

  test('accepts valid duration', () => {
    expect(validate_timeout_duration('30s')).toMatchObject({ error: null, ms: 30000 })
    expect(validate_timeout_duration('2h')).toMatchObject({ error: null, ms: 2 * 60 * 60 * 1000 })
  })
})
