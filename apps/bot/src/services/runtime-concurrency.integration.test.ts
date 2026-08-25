import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { prisma } from '@yuebot/database'
import { commandCooldownService } from './commandCooldown.service'
import { dailyRewardService } from './dailyReward.service'

const RUN = process.env.RUN_DATABASE_INTEGRATION === '1'

async function with_test_guild(run: (guild_id: string) => Promise<void>) {
  const guild_id = `test-${randomUUID()}`
  await prisma.guild.create({ data: { id: guild_id, name: 'Concurrency Test', ownerId: 'test-owner' } })
  try {
    await run(guild_id)
  } finally {
    await prisma.userCommandCooldown.deleteMany({ where: { guildId: guild_id } })
    await prisma.guildCommandCooldown.deleteMany({ where: { guildId: guild_id } })
    await prisma.luazinhaTransaction.deleteMany({ where: { guildId: guild_id } })
    await prisma.guild.deleteMany({ where: { id: guild_id } })
  }
}

test('daily reward credits exactly once under concurrent claims', { skip: !RUN }, async () => {
  await with_test_guild(async (guild_id) => {
    const user_id = `user-${randomUUID()}`
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, () => dailyRewardService.claimReward(user_id, guild_id))
      )

      assert.equal(results.filter((result) => result.success).length, 1)
      assert.equal(results.filter((result) => result.success === false && result.error === 'cooldown').length, 11)

      const [wallet, reward_state, transactions] = await Promise.all([
        prisma.wallet.findUnique({ where: { userId: user_id } }),
        prisma.userDailyReward.findUnique({ where: { userId: user_id } }),
        prisma.luazinhaTransaction.count({ where: { guildId: guild_id, toUserId: user_id, type: 'daily_reward' } }),
      ])

      assert.equal(wallet?.balance, 1100n)
      assert.equal(reward_state?.totalClaims, 1)
      assert.equal(transactions, 1)
    } finally {
      await prisma.luazinhaTransaction.deleteMany({ where: { toUserId: user_id } })
      await prisma.userDailyReward.deleteMany({ where: { userId: user_id } })
      await prisma.wallet.deleteMany({ where: { userId: user_id } })
      await prisma.user.deleteMany({ where: { id: user_id } })
    }
  })
})

test('command cooldown admits one concurrent reservation', { skip: !RUN }, async () => {
  await with_test_guild(async (guild_id) => {
    const user_id = `user-${randomUUID()}`
    const command_name = `cmd-${randomUUID()}`
    await prisma.guildCommandCooldown.create({
      data: { guildId: guild_id, commandName: command_name, cooldownSeconds: 60 },
    })

    const results = await Promise.all(
      Array.from({ length: 12 }, () => commandCooldownService.consumeCooldown(guild_id, user_id, command_name))
    )

    assert.equal(results.filter((result) => !result.onCooldown).length, 1)
    assert.equal(results.filter((result) => result.onCooldown).length, 11)
    assert.equal(await prisma.userCommandCooldown.count({ where: { guildId: guild_id, userId: user_id, commandName: command_name } }), 1)
  })
})
