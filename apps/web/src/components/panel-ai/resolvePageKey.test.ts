import { describe, expect, test } from 'vitest'
import { resolvePanelAiPageKey } from './resolvePageKey'
import { PANEL_AI_PAGES } from '@yuebot/shared'

describe('resolvePanelAiPageKey', () => {
  test('resolves guild root', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1')).toBe('guild-root')
  })

  test('resolves overview', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/overview')).toBe('overview')
  })

  test('resolves automod', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/automod')).toBe('automod')
  })

  test('resolves antiraid', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/antiraid')).toBe('antiraid')
  })

  test('resolves music', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/music')).toBe('music')
  })

  test('resolves member list', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/members')).toBe('members')
  })

  test('resolves member details', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/members/user-123')).toBe('member-details')
  })

  test('resolves giveaway list', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/giveaways')).toBe('giveaways')
  })

  test('resolves giveaway create', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/giveaways/create')).toBe('giveaway-create')
  })

  test('resolves giveaway details', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/giveaways/giveaway-123')).toBe('giveaway-details')
  })

  test('resolves support', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/support')).toBe('support')
  })

  test('resolves settings', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/settings')).toBe('settings')
  })

  test('resolves assistant', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/assistant')).toBe('assistant')
  })

  test('resolves every other registered guild route', () => {
    for (const page of PANEL_AI_PAGES) {
      // Replaces parameters with dummy values to simulate actual pathname
      const testPath = page.routePattern
        .replace(':guildId', 'guild-abc')
        .replace(':userId', 'user-xyz')
        .replace(':giveawayId', 'giveaway-789')
      expect(resolvePanelAiPageKey(testPath)).toBe(page.key)
    }
  })

  test('resolves with trailing slash', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/music/')).toBe('music')
  })

  test('resolves with query string', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/music?autoplay=true&volume=80')).toBe('music')
  })

  test('resolves with hash', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/music#queue-section')).toBe('music')
  })

  test('resolves with query string plus hash', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/music?autoplay=true#queue-section')).toBe('music')
  })

  test('returns null for unknown guild route', () => {
    expect(resolvePanelAiPageKey('/guild/guild-1/not-a-real-page')).toBeNull()
  })

  test('returns null for non-guild route', () => {
    expect(resolvePanelAiPageKey('/economy')).toBeNull()
    expect(resolvePanelAiPageKey('/badges')).toBeNull()
  })

  test('dynamic IDs never appear in the resolved result', () => {
    const result = resolvePanelAiPageKey('/guild/guild-123/members/user-456')
    expect(result).toBe('member-details')
    expect(result).not.toContain('guild-123')
    expect(result).not.toContain('user-456')
  })
})
