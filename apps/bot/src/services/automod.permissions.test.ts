import test from 'node:test'
import assert from 'node:assert/strict'

import { can_apply_automod_action, required_channel_permissions_for_automod_action } from './automod.permissions'

function perms_stub(has: (perm: bigint) => boolean) {
  return { has }
}

test('required_channel_permissions_for_automod_action: includes ManageMessages always', () => {
  const required = required_channel_permissions_for_automod_action('warn')
  assert.ok(required.length >= 1)
})

test('can_apply_automod_action: ok when all permissions present', () => {
  const required = required_channel_permissions_for_automod_action('mute')
  const res = can_apply_automod_action('mute', perms_stub((perm) => required.includes(perm)))
  assert.equal(res.ok, true)
  assert.deepEqual(res.missing, [])
})

test('can_apply_automod_action: reports missing permissions', () => {
  const required = required_channel_permissions_for_automod_action('ban')
  const missing_perm = required[0]
  const res = can_apply_automod_action('ban', perms_stub((perm) => perm !== missing_perm))
  assert.equal(res.ok, false)
  assert.deepEqual(res.missing, [missing_perm])
})
