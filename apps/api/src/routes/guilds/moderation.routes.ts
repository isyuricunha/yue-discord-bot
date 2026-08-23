import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  autoModConfigSchema,
  guildAntiRaidConfigSchema,
  guildAutomodConfigSchema,
  guildModlogConfigSchema,
} from '@yuebot/shared'
import { sync_automod_native_rules } from '../../internal/bot_internal_api'
import { parse_pagination_query } from '../../utils/pagination'
import { validation_error_details } from '../../utils/validation_error'
import { requireGuildAccess, requireGuildAdmin } from './authorization'

export async function guildModerationRoutes(fastify: FastifyInstance) {
  const access = [fastify.authenticate, requireGuildAccess]
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/:guildId/automod-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: {
          muteRoleId: true,
          muteRoleIds: true,
          wordFilterEnabled: true,
          bannedWords: true,
          wordFilterWhitelistChannels: true,
          wordFilterWhitelistRoles: true,
          capsEnabled: true,
          capsThreshold: true,
          capsMinLength: true,
          capsAction: true,
          capsWhitelistChannels: true,
          capsWhitelistRoles: true,
          linkFilterEnabled: true,
          linkBlockAll: true,
          bannedDomains: true,
          allowedDomains: true,
          linkAction: true,
          linkTimeoutDuration: true,
          linkNoRoleEnabled: true,
          linkNoRoleAction: true,
          linkNoRoleTimeoutDuration: true,
          linkNotifyEnabled: true,
          linkWhitelistChannels: true,
          linkWhitelistRoles: true,
          warnThresholds: true,
          warnExpiration: true,
          aiModerationEnabled: true,
          aiModerationAction: true,
          aiModerationLevel: true,
          aiModerationThresholds: true,
        },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({ success: true, config })
  })

  fastify.put('/:guildId/automod-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildAutomodConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const normalized_mute_role_ids = (input.muteRoleIds ?? []).filter(Boolean)
    const normalized_mute_role_id =
      input.muteRoleId !== undefined
        ? input.muteRoleId
        : (normalized_mute_role_ids[0] ?? null)

    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(input.muteRoleIds !== undefined
          ? {
              muteRoleIds: normalized_mute_role_ids,
              muteRoleId: normalized_mute_role_ids[0] ?? null,
            }
          : {}),
        ...(input.muteRoleId !== undefined ? { muteRoleId: input.muteRoleId } : {}),
        ...(input.wordFilterEnabled !== undefined ? { wordFilterEnabled: input.wordFilterEnabled } : {}),
        ...(input.bannedWords !== undefined ? { bannedWords: input.bannedWords } : {}),
        ...(input.wordFilterWhitelistChannels !== undefined
          ? { wordFilterWhitelistChannels: input.wordFilterWhitelistChannels }
          : {}),
        ...(input.wordFilterWhitelistRoles !== undefined
          ? { wordFilterWhitelistRoles: input.wordFilterWhitelistRoles }
          : {}),
        ...(input.capsEnabled !== undefined ? { capsEnabled: input.capsEnabled } : {}),
        ...(input.capsThreshold !== undefined ? { capsThreshold: input.capsThreshold } : {}),
        ...(input.capsMinLength !== undefined ? { capsMinLength: input.capsMinLength } : {}),
        ...(input.capsAction !== undefined ? { capsAction: input.capsAction } : {}),
        ...(input.capsWhitelistChannels !== undefined ? { capsWhitelistChannels: input.capsWhitelistChannels } : {}),
        ...(input.capsWhitelistRoles !== undefined ? { capsWhitelistRoles: input.capsWhitelistRoles } : {}),
        ...(input.linkFilterEnabled !== undefined ? { linkFilterEnabled: input.linkFilterEnabled } : {}),
        ...(input.linkBlockAll !== undefined ? { linkBlockAll: input.linkBlockAll } : {}),
        ...(input.bannedDomains !== undefined ? { bannedDomains: input.bannedDomains } : {}),
        ...(input.allowedDomains !== undefined ? { allowedDomains: input.allowedDomains } : {}),
        ...(input.linkAction !== undefined ? { linkAction: input.linkAction } : {}),
        ...(input.linkTimeoutDuration !== undefined ? { linkTimeoutDuration: input.linkTimeoutDuration } : {}),
        ...(input.linkNoRoleEnabled !== undefined ? { linkNoRoleEnabled: input.linkNoRoleEnabled } : {}),
        ...(input.linkNoRoleAction !== undefined ? { linkNoRoleAction: input.linkNoRoleAction } : {}),
        ...(input.linkNoRoleTimeoutDuration !== undefined
          ? { linkNoRoleTimeoutDuration: input.linkNoRoleTimeoutDuration }
          : {}),
        ...(input.linkNotifyEnabled !== undefined ? { linkNotifyEnabled: input.linkNotifyEnabled } : {}),
        ...(input.linkWhitelistChannels !== undefined ? { linkWhitelistChannels: input.linkWhitelistChannels } : {}),
        ...(input.linkWhitelistRoles !== undefined ? { linkWhitelistRoles: input.linkWhitelistRoles } : {}),
        ...(input.warnThresholds !== undefined ? { warnThresholds: input.warnThresholds } : {}),
        ...(input.warnExpiration !== undefined ? { warnExpiration: input.warnExpiration } : {}),
        ...(input.aiModerationEnabled !== undefined ? { aiModerationEnabled: input.aiModerationEnabled } : {}),
        ...(input.aiModerationAction !== undefined ? { aiModerationAction: input.aiModerationAction } : {}),
        ...(input.aiModerationLevel !== undefined ? { aiModerationLevel: input.aiModerationLevel } : {}),
        ...(input.aiModerationThresholds !== undefined
          ? { aiModerationThresholds: input.aiModerationThresholds }
          : {}),
      },
      create: {
        guildId,
        muteRoleId: normalized_mute_role_id,
        muteRoleIds: input.muteRoleIds ?? (normalized_mute_role_id ? [normalized_mute_role_id] : []),
        wordFilterEnabled: input.wordFilterEnabled ?? false,
        bannedWords: input.bannedWords ?? [],
        wordFilterWhitelistChannels: input.wordFilterWhitelistChannels ?? [],
        wordFilterWhitelistRoles: input.wordFilterWhitelistRoles ?? [],
        capsEnabled: input.capsEnabled ?? false,
        capsThreshold: input.capsThreshold ?? 70,
        capsMinLength: input.capsMinLength ?? 10,
        capsAction: input.capsAction ?? 'warn',
        capsWhitelistChannels: input.capsWhitelistChannels ?? [],
        capsWhitelistRoles: input.capsWhitelistRoles ?? [],
        linkFilterEnabled: input.linkFilterEnabled ?? false,
        linkBlockAll: input.linkBlockAll ?? false,
        bannedDomains: input.bannedDomains ?? [],
        allowedDomains: input.allowedDomains ?? [],
        linkAction: input.linkAction ?? 'delete',
        linkTimeoutDuration: input.linkTimeoutDuration ?? '5m',
        linkNoRoleEnabled: input.linkNoRoleEnabled ?? false,
        linkNoRoleAction: input.linkNoRoleAction ?? 'mute',
        linkNoRoleTimeoutDuration: input.linkNoRoleTimeoutDuration ?? '10m',
        linkNotifyEnabled: input.linkNotifyEnabled ?? true,
        linkWhitelistChannels: input.linkWhitelistChannels ?? [],
        linkWhitelistRoles: input.linkWhitelistRoles ?? [],
        warnThresholds: input.warnThresholds ?? [],
        warnExpiration: input.warnExpiration ?? 30,
        aiModerationEnabled: input.aiModerationEnabled ?? false,
        aiModerationAction: input.aiModerationAction ?? 'delete',
        aiModerationLevel: input.aiModerationLevel ?? 'medio',
        aiModerationThresholds: input.aiModerationThresholds ?? {},
      },
      select: {
        muteRoleId: true,
        muteRoleIds: true,
        wordFilterEnabled: true,
        bannedWords: true,
        wordFilterWhitelistChannels: true,
        wordFilterWhitelistRoles: true,
        capsEnabled: true,
        capsThreshold: true,
        capsMinLength: true,
        capsAction: true,
        capsWhitelistChannels: true,
        capsWhitelistRoles: true,
        linkFilterEnabled: true,
        linkBlockAll: true,
        bannedDomains: true,
        allowedDomains: true,
        linkAction: true,
        linkTimeoutDuration: true,
        linkNoRoleEnabled: true,
        linkNoRoleAction: true,
        linkNoRoleTimeoutDuration: true,
        linkNotifyEnabled: true,
        linkWhitelistChannels: true,
        linkWhitelistRoles: true,
        warnThresholds: true,
        warnExpiration: true,
        aiModerationEnabled: true,
        aiModerationAction: true,
        aiModerationLevel: true,
        aiModerationThresholds: true,
      },
    })

    sync_automod_native_rules(guildId, request.log).catch((error) => {
      request.log.error({ err: error, guildId }, 'Failed to trigger automod native sync from bot')
    })

    return reply.send({ success: true, config: updated })
  })

  // Legacy all-in-one configuration endpoint kept for panel compatibility.
  fastify.put('/:guildId/config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = autoModConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const configData = parsed.data
    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        wordFilterEnabled: configData.wordFilterEnabled,
        ...(configData.bannedWords !== undefined ? { bannedWords: configData.bannedWords } : {}),
        ...(configData.wordFilterWhitelistChannels !== undefined
          ? { wordFilterWhitelistChannels: configData.wordFilterWhitelistChannels }
          : {}),
        ...(configData.wordFilterWhitelistRoles !== undefined
          ? { wordFilterWhitelistRoles: configData.wordFilterWhitelistRoles }
          : {}),
        capsEnabled: configData.capsEnabled,
        capsThreshold: configData.capsThreshold,
        capsMinLength: configData.capsMinLength,
        capsAction: configData.capsAction,
        ...(configData.capsWhitelistChannels !== undefined
          ? { capsWhitelistChannels: configData.capsWhitelistChannels }
          : {}),
        ...(configData.capsWhitelistRoles !== undefined
          ? { capsWhitelistRoles: configData.capsWhitelistRoles }
          : {}),
        linkFilterEnabled: configData.linkFilterEnabled,
        linkBlockAll: configData.linkBlockAll,
        ...(configData.bannedDomains !== undefined ? { bannedDomains: configData.bannedDomains } : {}),
        ...(configData.allowedDomains !== undefined ? { allowedDomains: configData.allowedDomains } : {}),
        linkAction: configData.linkAction,
        ...(configData.linkTimeoutDuration !== undefined
          ? { linkTimeoutDuration: configData.linkTimeoutDuration }
          : {}),
        ...(configData.linkNoRoleEnabled !== undefined ? { linkNoRoleEnabled: configData.linkNoRoleEnabled } : {}),
        ...(configData.linkNoRoleAction !== undefined ? { linkNoRoleAction: configData.linkNoRoleAction } : {}),
        ...(configData.linkNoRoleTimeoutDuration !== undefined
          ? { linkNoRoleTimeoutDuration: configData.linkNoRoleTimeoutDuration }
          : {}),
        ...(configData.linkNotifyEnabled !== undefined ? { linkNotifyEnabled: configData.linkNotifyEnabled } : {}),
        ...(configData.linkWhitelistChannels !== undefined
          ? { linkWhitelistChannels: configData.linkWhitelistChannels }
          : {}),
        ...(configData.linkWhitelistRoles !== undefined
          ? { linkWhitelistRoles: configData.linkWhitelistRoles }
          : {}),
        modLogChannelId: configData.modLogChannelId,
        announcementChannelId: configData.announcementChannelId,
        giveawayChannelId: configData.giveawayChannelId,
        welcomeChannelId: configData.welcomeChannelId,
        leaveChannelId: configData.leaveChannelId,
        ...(configData.welcomeMessage !== undefined ? { welcomeMessage: configData.welcomeMessage } : {}),
        ...(configData.leaveMessage !== undefined ? { leaveMessage: configData.leaveMessage } : {}),
        ...(configData.modLogMessage !== undefined ? { modLogMessage: configData.modLogMessage } : {}),
        muteRoleId: configData.muteRoleId,
        ...(configData.warnThresholds !== undefined ? { warnThresholds: configData.warnThresholds } : {}),
        ...(configData.warnExpiration !== undefined ? { warnExpiration: configData.warnExpiration } : {}),
        prefix: configData.prefix,
        locale: configData.locale,
        timezone: configData.timezone,
      },
      create: {
        guildId,
        wordFilterEnabled: configData.wordFilterEnabled || false,
        bannedWords: configData.bannedWords || [],
        wordFilterWhitelistChannels: configData.wordFilterWhitelistChannels || [],
        wordFilterWhitelistRoles: configData.wordFilterWhitelistRoles || [],
        capsEnabled: configData.capsEnabled || false,
        capsThreshold: configData.capsThreshold || 70,
        capsMinLength: configData.capsMinLength || 10,
        capsAction: configData.capsAction || 'warn',
        capsWhitelistChannels: configData.capsWhitelistChannels || [],
        capsWhitelistRoles: configData.capsWhitelistRoles || [],
        linkFilterEnabled: configData.linkFilterEnabled || false,
        linkBlockAll: configData.linkBlockAll || false,
        bannedDomains: configData.bannedDomains || [],
        allowedDomains: configData.allowedDomains || [],
        linkAction: configData.linkAction || 'delete',
        linkTimeoutDuration: configData.linkTimeoutDuration || '5m',
        linkNoRoleEnabled: configData.linkNoRoleEnabled || false,
        linkNoRoleAction: configData.linkNoRoleAction || 'mute',
        linkNoRoleTimeoutDuration: configData.linkNoRoleTimeoutDuration || '10m',
        linkNotifyEnabled: configData.linkNotifyEnabled ?? true,
        linkWhitelistChannels: configData.linkWhitelistChannels || [],
        linkWhitelistRoles: configData.linkWhitelistRoles || [],
        modLogChannelId: configData.modLogChannelId,
        announcementChannelId: configData.announcementChannelId,
        giveawayChannelId: configData.giveawayChannelId,
        welcomeChannelId: configData.welcomeChannelId,
        leaveChannelId: configData.leaveChannelId,
        welcomeMessage: configData.welcomeMessage ?? null,
        leaveMessage: configData.leaveMessage ?? null,
        modLogMessage: configData.modLogMessage ?? null,
        muteRoleId: configData.muteRoleId,
        warnThresholds: configData.warnThresholds || [],
        warnExpiration: configData.warnExpiration || 30,
        prefix: configData.prefix || '/',
        locale: configData.locale || 'pt-BR',
        timezone: configData.timezone || 'America/Sao_Paulo',
      },
    })

    return { success: true, config }
  })

  fastify.get('/:guildId/modlog-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { modLogChannelId: true, modLogMessage: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({
      success: true,
      config: {
        modLogChannelId: config.modLogChannelId,
        modLogMessage: config.modLogMessage,
      },
    })
  })

  fastify.put('/:guildId/modlog-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildModlogConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(input.modLogChannelId !== undefined ? { modLogChannelId: input.modLogChannelId } : {}),
        ...(input.modLogMessage !== undefined ? { modLogMessage: input.modLogMessage } : {}),
      },
      create: {
        guildId,
        modLogChannelId: input.modLogChannelId ?? null,
        modLogMessage: input.modLogMessage ?? null,
      },
      select: { modLogChannelId: true, modLogMessage: true },
    })

    return reply.send({ success: true, config: updated })
  })

  fastify.get('/:guildId/modlogs', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { limit, offset } = parse_pagination_query(request.query, { defaultLimit: 50, maxLimit: 200 })

    const logs = await prisma.modLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const ids_to_resolve = Array.from(
      new Set(
        logs
          .flatMap((log) => [log.userId, log.moderatorId])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

    const members = ids_to_resolve.length
      ? await prisma.guildMember.findMany({
          where: { guildId, userId: { in: ids_to_resolve } },
          select: { userId: true, username: true },
        })
      : []

    const name_by_id = new Map(members.map((member) => [member.userId, member.username]))
    const total = await prisma.modLog.count({ where: { guildId } })

    const enriched = logs.map((log) => ({
      id: log.id,
      guildId: log.guildId,
      action: log.action.toUpperCase(),
      moderatorId: log.moderatorId,
      moderatorName: name_by_id.get(log.moderatorId) ?? (log.moderatorId ? 'AutoMod' : ''),
      targetId: log.userId,
      targetName: name_by_id.get(log.userId) ?? log.userId,
      userId: log.userId,
      reason: log.reason,
      duration: log.duration,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }))

    return reply.send({ success: true, logs: enriched, total })
  })

  fastify.get('/:guildId/antiraid-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.guildAntiRaidConfig.findUnique({ where: { guildId } })

    if (!config) {
      return reply.send({
        success: true,
        config: {
          enabled: false,
          joinThreshold: 10,
          joinTimeWindow: 60,
          action: 'mute',
          duration: 10,
          exemptRoles: [],
          exemptChannels: [],
          cooldown: 300,
          notificationChannelId: null,
          raidActive: false,
          locked: false,
        },
      })
    }

    return reply.send({ success: true, config })
  })

  fastify.put('/:guildId/antiraid-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildAntiRaidConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildAntiRaidConfig.upsert({
      where: { guildId },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.joinThreshold !== undefined ? { joinThreshold: input.joinThreshold } : {}),
        ...(input.joinTimeWindow !== undefined ? { joinTimeWindow: input.joinTimeWindow } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.exemptRoles !== undefined ? { exemptRoles: input.exemptRoles } : {}),
        ...(input.exemptChannels !== undefined ? { exemptChannels: input.exemptChannels } : {}),
        ...(input.cooldown !== undefined ? { cooldown: input.cooldown } : {}),
        ...(input.notificationChannelId !== undefined
          ? { notificationChannelId: input.notificationChannelId }
          : {}),
      },
      create: {
        guildId,
        enabled: input.enabled ?? false,
        joinThreshold: input.joinThreshold ?? 10,
        joinTimeWindow: input.joinTimeWindow ?? 60,
        action: input.action ?? 'mute',
        duration: input.duration ?? 10,
        exemptRoles: input.exemptRoles ?? [],
        exemptChannels: input.exemptChannels ?? [],
        cooldown: input.cooldown ?? 300,
        notificationChannelId: input.notificationChannelId ?? null,
        raidActive: false,
        locked: false,
      },
    })

    return reply.send({ success: true, config: updated })
  })
}
