import test from 'node:test'
import assert from 'node:assert/strict'

import type { GuildXpConfig } from '@yuebot/database'

import { compute_level_from_xp, normalize_xp_config } from './xp.service'

test('normalize_xp_config provides level-up defaults without a database row', () => {
  const config = normalize_xp_config(null)

  assert.equal(config.rewardMode, 'stack')
  assert.equal(config.levelUpEnabled, true)
  assert.equal(config.levelUpChannelId, null)
  assert.equal(config.levelUpMessage, null)
})

test('normalize_xp_config preserves configured level-up behavior', () => {
  const config = normalize_xp_config({
    rewardMode: 'highest',
    levelUpEnabled: false,
    levelUpChannelId: 'channel-1',
    levelUpMessage: 'Level {level}',
  } as GuildXpConfig)

  assert.equal(config.rewardMode, 'highest')
  assert.equal(config.levelUpEnabled, false)
  assert.equal(config.levelUpChannelId, 'channel-1')
  assert.equal(config.levelUpMessage, 'Level {level}')
})

test('compute_level_from_xp keeps the 1000 XP level boundaries', () => {
  assert.equal(compute_level_from_xp(0), 0)
  assert.equal(compute_level_from_xp(999), 0)
  assert.equal(compute_level_from_xp(1000), 1)
  assert.equal(compute_level_from_xp(2999), 2)
})
