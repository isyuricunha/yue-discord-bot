import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  guildAutoroleConfigSchema,
  guildXpConfigSchema,
  xpResetSchema,
} from '@yuebot/shared'
import { parse_pagination_query } from '../../utils/pagination'
import { validation_error_details } from '../../utils/validation_error'
import { requireGuildAccess, requireGuildAdmin } from './authorization'

export async function guildXpRoutes(fastify: FastifyInstance) {
  const access = [fastify.authenticate, requireGuildAccess]
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/:guildId/xp-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.guildXpConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        xpMode: true,
        xpPerMessage: true,
        xpPerVoiceMinute: true,
        xpBonusMinLength: true,
        xpBonusAmount: true,
        dailyXpBonusEnabled: true,
        dailyXpBonusAmount: true,
        voiceXpEnabled: true,
        voiceXpRate: true,
        minMessageLength: true,
        minUniqueLength: true,
        typingCps: true,
        xpDivisorMin: true,
        xpDivisorMax: true,
        xpCap: true,
        ignoredChannelIds: true,
        ignoredRoleIds: true,
        roleXpMultipliers: true,
        rewardMode: true,
        levelUpEnabled: true,
        levelUpChannelId: true,
        levelUpMessage: true,
        voiceXpNotificationsEnabled: true,
      },
    })

    const rewards = await prisma.guildLevelRoleReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    })

    return reply.send({
      success: true,
      config: config ?? {
        enabled: true,
        xpMode: 'formula',
        xpPerMessage: 1,
        xpPerVoiceMinute: 1,
        xpBonusMinLength: 0,
        xpBonusAmount: 0,
        dailyXpBonusEnabled: false,
        dailyXpBonusAmount: 0,
        voiceXpEnabled: false,
        voiceXpRate: 10,
        minMessageLength: 5,
        minUniqueLength: 12,
        typingCps: 7,
        xpDivisorMin: 7,
        xpDivisorMax: 4,
        xpCap: 35,
        ignoredChannelIds: [],
        ignoredRoleIds: [],
        roleXpMultipliers: {},
        rewardMode: 'stack',
        levelUpEnabled: true,
        levelUpChannelId: null,
        levelUpMessage: null,
        voiceXpNotificationsEnabled: true,
      },
      rewards,
    })
  })

  fastify.put('/:guildId/xp-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildXpConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const rewards = data.rewards

    if (rewards && rewards.length > 15) {
      return reply.code(400).send({ error: 'reward limit exceeded (max 15)' })
    }

    const config = await prisma.$transaction(async (tx) => {
      const updated = await tx.guildXpConfig.upsert({
        where: { guildId },
        update: {
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
          ...(data.xpMode !== undefined ? { xpMode: data.xpMode } : {}),
          ...(data.xpPerMessage !== undefined ? { xpPerMessage: data.xpPerMessage } : {}),
          ...(data.xpPerVoiceMinute !== undefined ? { xpPerVoiceMinute: data.xpPerVoiceMinute } : {}),
          ...(data.xpBonusMinLength !== undefined ? { xpBonusMinLength: data.xpBonusMinLength } : {}),
          ...(data.xpBonusAmount !== undefined ? { xpBonusAmount: data.xpBonusAmount } : {}),
          ...(data.dailyXpBonusEnabled !== undefined ? { dailyXpBonusEnabled: data.dailyXpBonusEnabled } : {}),
          ...(data.dailyXpBonusAmount !== undefined ? { dailyXpBonusAmount: data.dailyXpBonusAmount } : {}),
          ...(data.voiceXpEnabled !== undefined ? { voiceXpEnabled: data.voiceXpEnabled } : {}),
          ...(data.voiceXpRate !== undefined ? { voiceXpRate: data.voiceXpRate } : {}),
          ...(data.minMessageLength !== undefined ? { minMessageLength: data.minMessageLength } : {}),
          ...(data.minUniqueLength !== undefined ? { minUniqueLength: data.minUniqueLength } : {}),
          ...(data.typingCps !== undefined ? { typingCps: data.typingCps } : {}),
          ...(data.xpDivisorMin !== undefined ? { xpDivisorMin: data.xpDivisorMin } : {}),
          ...(data.xpDivisorMax !== undefined ? { xpDivisorMax: data.xpDivisorMax } : {}),
          ...(data.xpCap !== undefined ? { xpCap: data.xpCap } : {}),
          ...(data.ignoredChannelIds !== undefined ? { ignoredChannelIds: data.ignoredChannelIds } : {}),
          ...(data.ignoredRoleIds !== undefined ? { ignoredRoleIds: data.ignoredRoleIds } : {}),
          ...(data.roleXpMultipliers !== undefined ? { roleXpMultipliers: data.roleXpMultipliers } : {}),
          ...(data.rewardMode !== undefined ? { rewardMode: data.rewardMode } : {}),
          ...(data.levelUpChannelId !== undefined ? { levelUpChannelId: data.levelUpChannelId ?? null } : {}),
          ...(data.levelUpMessage !== undefined ? { levelUpMessage: data.levelUpMessage ?? null } : {}),
          ...(data.voiceXpNotificationsEnabled !== undefined
            ? { voiceXpNotificationsEnabled: data.voiceXpNotificationsEnabled }
            : {}),
        },
        create: {
          guildId,
          enabled: data.enabled ?? true,
          xpMode: data.xpMode ?? 'formula',
          xpPerMessage: data.xpPerMessage ?? 1,
          xpPerVoiceMinute: data.xpPerVoiceMinute ?? 1,
          xpBonusMinLength: data.xpBonusMinLength ?? 0,
          xpBonusAmount: data.xpBonusAmount ?? 0,
          dailyXpBonusEnabled: data.dailyXpBonusEnabled ?? false,
          dailyXpBonusAmount: data.dailyXpBonusAmount ?? 0,
          voiceXpEnabled: data.voiceXpEnabled ?? false,
          voiceXpRate: data.voiceXpRate ?? 10,
          minMessageLength: data.minMessageLength ?? 5,
          minUniqueLength: data.minUniqueLength ?? 12,
          typingCps: data.typingCps ?? 7,
          xpDivisorMin: data.xpDivisorMin ?? 7,
          xpDivisorMax: data.xpDivisorMax ?? 4,
          xpCap: data.xpCap ?? 35,
          ignoredChannelIds: data.ignoredChannelIds ?? [],
          ignoredRoleIds: data.ignoredRoleIds ?? [],
          roleXpMultipliers: data.roleXpMultipliers ?? {},
          rewardMode: data.rewardMode ?? 'stack',
          levelUpChannelId: data.levelUpChannelId ?? null,
          levelUpMessage: data.levelUpMessage ?? null,
          voiceXpNotificationsEnabled: data.voiceXpNotificationsEnabled ?? true,
        },
      })

      if (rewards) {
        await tx.guildLevelRoleReward.deleteMany({ where: { guildId } })

        if (rewards.length > 0) {
          await tx.guildLevelRoleReward.createMany({
            data: rewards.map((reward) => ({
              guildId,
              level: reward.level,
              roleId: reward.roleId,
            })),
          })
        }
      }

      return updated
    })

    const updated_rewards = await prisma.guildLevelRoleReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    })

    return { success: true, config, rewards: updated_rewards }
  })

  fastify.get('/:guildId/xp-leaderboard', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { limit, offset } = parse_pagination_query(request.query, { defaultLimit: 25, maxLimit: 100 })

    const rows = await prisma.guildXpMember.findMany({
      where: { guildId },
      orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      skip: offset,
    })

    const total = await prisma.guildXpMember.count({ where: { guildId } })
    const ids = rows.map((row) => row.userId)
    const members = ids.length
      ? await prisma.guildMember.findMany({
          where: { guildId, userId: { in: ids } },
          select: { userId: true, username: true, avatar: true },
        })
      : []

    const member_by_id = new Map(members.map((member) => [member.userId, member]))
    const leaderboard = rows.map((row, index) => {
      const info = member_by_id.get(row.userId)
      return {
        userId: row.userId,
        username: info?.username ?? row.userId,
        avatar: info?.avatar ?? null,
        xp: row.xp,
        level: row.level,
        position: offset + index + 1,
      }
    })

    return reply.send({ success: true, leaderboard, total })
  })

  fastify.get('/:guildId/xp-me', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const member = await prisma.guildXpMember.findUnique({
      where: {
        userId_guildId: {
          userId: request.user.userId,
          guildId,
        },
      },
    })

    if (!member) {
      return reply.send({ success: true, xp: 0, level: 0, position: null })
    }

    const above = await prisma.guildXpMember.count({
      where: { guildId, xp: { gt: member.xp } },
    })

    return reply.send({ success: true, xp: member.xp, level: member.level, position: above + 1 })
  })

  fastify.post('/:guildId/xp-reset', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = xpResetSchema.safeParse(request.body ?? {})

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const { scope, userId } = parsed.data
    if (scope === 'user' && !userId) {
      return reply.code(400).send({ error: 'userId is required for scope=user' })
    }

    const result = await prisma.guildXpMember.deleteMany({
      where: {
        guildId,
        ...(scope === 'user' ? { userId } : {}),
      },
    })

    return { success: true, deleted: result.count, scope }
  })

  fastify.get('/:guildId/autorole-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.guildAutoroleConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        delaySeconds: true,
        onlyAfterFirstMessage: true,
      },
    })

    const roles = await prisma.guildAutoroleRole.findMany({
      where: { guildId },
      orderBy: { roleId: 'asc' },
    })

    return reply.send({
      success: true,
      config: config ?? {
        enabled: false,
        delaySeconds: 0,
        onlyAfterFirstMessage: false,
      },
      roleIds: roles.map((role) => role.roleId),
    })
  })

  fastify.put('/:guildId/autorole-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildAutoroleConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const role_ids = data.roleIds

    const config = await prisma.$transaction(async (tx) => {
      const updated = await tx.guildAutoroleConfig.upsert({
        where: { guildId },
        update: {
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
          ...(data.delaySeconds !== undefined ? { delaySeconds: data.delaySeconds } : {}),
          ...(data.onlyAfterFirstMessage !== undefined
            ? { onlyAfterFirstMessage: data.onlyAfterFirstMessage }
            : {}),
        },
        create: {
          guildId,
          enabled: data.enabled ?? false,
          delaySeconds: data.delaySeconds ?? 0,
          onlyAfterFirstMessage: data.onlyAfterFirstMessage ?? false,
        },
      })

      if (role_ids) {
        await tx.guildAutoroleRole.deleteMany({ where: { guildId } })

        if (role_ids.length > 0) {
          await tx.guildAutoroleRole.createMany({
            data: role_ids.map((roleId) => ({
              guildId,
              roleId,
              configId: updated.id,
            })),
            skipDuplicates: true,
          })
        }
      }

      return updated
    })

    const roles = await prisma.guildAutoroleRole.findMany({
      where: { guildId },
      orderBy: { roleId: 'asc' },
    })

    return { success: true, config, roleIds: roles.map((role) => role.roleId) }
  })
}
