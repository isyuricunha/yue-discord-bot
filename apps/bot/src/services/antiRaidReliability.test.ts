import test from 'node:test'
import assert from 'node:assert/strict'
import { PermissionFlagsBits } from 'discord.js'
import { prisma } from '@yuebot/database'
import { antiRaidService, filter_recent_anti_raid_joins, is_anti_raid_cooldown_active } from './antiRaid.service'

test('anti-raid reliability guards', async (t) => {
  await t.test('keeps joins for the configured five-minute detection window', () => {
    const now = Date.now()
    const records = [
      { timestamp: now - 200_000, memberId: 'old-but-valid' },
      { timestamp: now - 301_000, memberId: 'expired' },
    ]
    assert.deepEqual(filter_recent_anti_raid_joins(records, now, 300), [records[0]])
  })

  await t.test('cooldown remains active after raidActive is cleared', () => {
    const now = Date.now()
    assert.equal(is_anti_raid_cooldown_active(new Date(now - 30_000), 60, now), true)
    assert.equal(is_anti_raid_cooldown_active(new Date(now - 61_000), 60, now), false)
  })

  await t.test('only one concurrent trigger can claim a raid', async () => {
    const original_find = (prisma.guildAntiRaidConfig as any).findUnique
    const original_update_many = (prisma.guildAntiRaidConfig as any).updateMany
    let claims = 0
    try {
      ;(prisma.guildAntiRaidConfig as any).findUnique = async () => ({
        guildId: 'guild-1', enabled: true, raidActive: false, lastRaidAt: null,
        cooldown: 300, joinTimeWindow: 60, joinThreshold: 3, action: 'mute', duration: 10,
        exemptRoles: [], notificationChannelId: null,
      })
      ;(prisma.guildAntiRaidConfig as any).updateMany = async () => ({ count: claims++ == 0 ? 1 : 0 })
      ;(antiRaidService as any).joinCache.set('guild-1', [])
      const client = { guilds: { cache: new Map(), fetch: async () => null } }
      const results = await Promise.all([
        antiRaidService.triggerRaid('guild-1', client as any),
        antiRaidService.triggerRaid('guild-1', client as any),
      ])
      assert.equal(results.filter(Boolean).length, 1)
    } finally {
      ;(prisma.guildAntiRaidConfig as any).findUnique = original_find
      ;(prisma.guildAntiRaidConfig as any).updateMany = original_update_many
      antiRaidService.clearCache('guild-1')
    }
  })

  await t.test('unlock restores the exact @everyone permission snapshot', async () => {
    const original_find = (prisma.guildAntiRaidConfig as any).findUnique
    const original_update_many = (prisma.guildAntiRaidConfig as any).updateMany
    const original_update = (prisma.guildAntiRaidConfig as any).update
    const original = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory
    let locked = false
    let snapshot: string | null = null
    let applied: unknown = null
    try {
      ;(prisma.guildAntiRaidConfig as any).findUnique = async () => ({
        guildId: 'guild-1', locked, lockedEveryonePermissions: snapshot,
      })
      ;(prisma.guildAntiRaidConfig as any).updateMany = async ({ data }: any) => {
        locked = data.locked
        snapshot = data.lockedEveryonePermissions
        return { count: 1 }
      }
      ;(prisma.guildAntiRaidConfig as any).update = async ({ data }: any) => {
        locked = data.locked
        if ('lockedEveryonePermissions' in data) snapshot = data.lockedEveryonePermissions
        return {}
      }
      const everyone = {
        permissions: {
          bitfield: original,
          remove: () => ({ bitfield: original & ~PermissionFlagsBits.SendMessages }),
        },
        setPermissions: async (value: unknown) => { applied = value },
      }
      const guild = { roles: { everyone } }
      const client = { guilds: { cache: new Map([['guild-1', guild]]), fetch: async () => guild } }

      assert.equal(await antiRaidService.lockServer('guild-1', client as any), true)
      assert.equal(snapshot, original.toString())
      assert.equal(await antiRaidService.unlockServer('guild-1', client as any), true)
      assert.equal(applied, original)
      assert.equal(locked, false)
    } finally {
      ;(prisma.guildAntiRaidConfig as any).findUnique = original_find
      ;(prisma.guildAntiRaidConfig as any).updateMany = original_update_many
      ;(prisma.guildAntiRaidConfig as any).update = original_update
    }
  })
})
