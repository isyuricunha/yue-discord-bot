import test from 'node:test'
import assert from 'node:assert/strict'

import type { GuildConfig } from '@yuebot/database'

import { check_automod_link_message } from './automod.links'

function link_config(overrides: Partial<GuildConfig> = {}): GuildConfig {
  return {
    linkFilterEnabled: false,
    linkBlockAll: false,
    bannedDomains: [],
    allowedDomains: [],
    linkAction: 'delete',
    linkTimeoutDuration: '5m',
    linkNoRoleEnabled: false,
    linkNoRoleAction: 'mute',
    linkNoRoleTimeoutDuration: '10m',
    ...overrides,
  } as GuildConfig
}

test('automod link check applies the no-role action and timeout', () => {
  const result = check_automod_link_message({
    content: 'https://unknown.example/path',
    memberHasRoles: false,
    config: link_config({
      linkNoRoleEnabled: true,
      linkNoRoleAction: 'mute',
      linkNoRoleTimeoutDuration: '2h',
    }),
  })

  assert.deepEqual(result, {
    violated: true,
    reason: 'Link publicado por membro sem cargos',
    action: 'mute',
    duration: '2h',
    details: {
      policy: 'member_without_roles',
      hostname: 'unknown.example',
      configuredDomain: null,
      memberHasRoles: false,
    },
  })
})

test('automod link check uses the blocked-domain policy before the no-role policy', () => {
  const result = check_automod_link_message({
    content: 'steamgifts.com/giveaway',
    memberHasRoles: false,
    config: link_config({
      linkFilterEnabled: true,
      bannedDomains: ['steamgifts.com'],
      linkAction: 'ban',
      linkNoRoleEnabled: true,
      linkNoRoleAction: 'mute',
    }),
  })

  assert.equal(result.violated, true)
  if (!result.violated) return

  assert.equal(result.action, 'ban')
  assert.equal(result.duration, undefined)
  assert.match(result.reason, /steamgifts\.com/)
})

test('automod link check lets trusted domains pass for members without roles', () => {
  const result = check_automod_link_message({
    content: 'https://help.example.com/article',
    memberHasRoles: false,
    config: link_config({
      linkNoRoleEnabled: true,
      allowedDomains: ['example.com'],
    }),
  })

  assert.deepEqual(result, { violated: false })
})
