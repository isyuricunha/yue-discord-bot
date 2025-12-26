import type { FastifyInstance } from 'fastify';
import { prisma } from '@yuebot/database';
import { autoModConfigSchema, guildAutoroleConfigSchema, guildXpConfigSchema, xpResetSchema } from '@yuebot/shared';
import { get_guild_channels, get_guild_roles, send_guild_message } from '../internal/bot_internal_api';
import { safe_error_details } from '../utils/safe_error'
import { can_access_guild } from '../utils/guild_access'

export default async function guildRoutes(fastify: FastifyInstance) {
  const message_rate_limit = new Map<string, { count: number; windowStart: number }>();
  function can_send_message_now(user_id: string) {
    const window_ms = 10_000;
    const max_per_window = 5;

    const now = Date.now();
    const existing = message_rate_limit.get(user_id);
    if (!existing || now - existing.windowStart > window_ms) {
      message_rate_limit.set(user_id, { count: 1, windowStart: now });
      return true;
    }

    if (existing.count >= max_per_window) return false;
    existing.count += 1;
    return true;
  }

  // Listar guilds do usuário
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user;

    if (user.isOwner) {
      const installed = await prisma.guild.findMany({
        select: { id: true, name: true, icon: true },
        orderBy: { name: 'asc' },
      });
      return { guilds: installed };
    }

    const guildsData = user.guildsData || [];

    const guild_ids = guildsData.map((guild) => guild.id);
    if (guild_ids.length === 0) {
      return { guilds: [] };
    }

    const installed = await prisma.guild.findMany({
      where: {
        id: { in: guild_ids },
      },
      select: { id: true },
    });

    const installed_ids = new Set(installed.map((g) => g.id));

    // Retornar somente guilds onde o bot está instalado (presentes no banco)
    return { guilds: guildsData.filter((guild) => installed_ids.has(guild.id)) };
  });

  // Obter configuração de uma guild
  fastify.get('/:guildId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    // Verificar permissão
    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { config: true },
    });

    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' });
    }

    return { guild };
  });

  fastify.post('/:guildId/messages', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const body = request.body as { channelId?: string; content?: string };

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!body?.channelId || typeof body.channelId !== 'string') {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    if (content.length > 2000) {
      return reply.code(400).send({ error: 'Message too long' });
    }

    if (!can_send_message_now(user.userId)) {
      return reply.code(429).send({ error: 'Rate limited' });
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } });
    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' });
    }

    const result = await send_guild_message(guildId, body.channelId, content, request.log);
    return reply.send({ success: true, messageId: result.messageId });
  });

  // Atualizar configuração de AutoMod
  fastify.put('/:guildId/config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = autoModConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const configData = parsed.data;

    // Verificar permissão
    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Criar ou atualizar config
    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        // Palavras
        wordFilterEnabled: configData.wordFilterEnabled,
        ...(configData.bannedWords !== undefined ? { bannedWords: configData.bannedWords } : {}),
        ...(configData.wordFilterWhitelistChannels !== undefined
          ? { wordFilterWhitelistChannels: configData.wordFilterWhitelistChannels }
          : {}),
        ...(configData.wordFilterWhitelistRoles !== undefined
          ? { wordFilterWhitelistRoles: configData.wordFilterWhitelistRoles }
          : {}),
        
        // CAPS
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
        
        // Links
        linkFilterEnabled: configData.linkFilterEnabled,
        linkBlockAll: configData.linkBlockAll,
        ...(configData.bannedDomains !== undefined ? { bannedDomains: configData.bannedDomains } : {}),
        ...(configData.allowedDomains !== undefined ? { allowedDomains: configData.allowedDomains } : {}),
        linkAction: configData.linkAction,
        ...(configData.linkWhitelistChannels !== undefined
          ? { linkWhitelistChannels: configData.linkWhitelistChannels }
          : {}),
        ...(configData.linkWhitelistRoles !== undefined
          ? { linkWhitelistRoles: configData.linkWhitelistRoles }
          : {}),
        
        // Canais
        modLogChannelId: configData.modLogChannelId,
        giveawayChannelId: configData.giveawayChannelId,
        welcomeChannelId: configData.welcomeChannelId,
        leaveChannelId: configData.leaveChannelId,

        // Mensagens automáticas
        ...(configData.welcomeMessage !== undefined ? { welcomeMessage: configData.welcomeMessage } : {}),
        ...(configData.leaveMessage !== undefined ? { leaveMessage: configData.leaveMessage } : {}),
        ...(configData.modLogMessage !== undefined ? { modLogMessage: configData.modLogMessage } : {}),
        
        // Moderação
        muteRoleId: configData.muteRoleId,

        // Warns
        ...(configData.warnThresholds !== undefined ? { warnThresholds: configData.warnThresholds } : {}),
        ...(configData.warnExpiration !== undefined ? { warnExpiration: configData.warnExpiration } : {}),
        
        // Configurações gerais
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
        linkWhitelistChannels: configData.linkWhitelistChannels || [],
        linkWhitelistRoles: configData.linkWhitelistRoles || [],
        modLogChannelId: configData.modLogChannelId,
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
    });

    return { success: true, config };
  });

  // Buscar logs de moderação
  fastify.get('/:guildId/modlogs', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const logs = await prisma.modLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const ids_to_resolve = Array.from(
      new Set(
        logs
          .flatMap((log) => [log.userId, log.moderatorId])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const members = ids_to_resolve.length
      ? await prisma.guildMember.findMany({
          where: {
            guildId,
            userId: { in: ids_to_resolve },
          },
          select: {
            userId: true,
            username: true,
          },
        })
      : [];

    const name_by_id = new Map(members.map((m) => [m.userId, m.username]));

    const total = await prisma.modLog.count({ where: { guildId } });

    const enriched = logs.map((log) => {
      const moderator_name = name_by_id.get(log.moderatorId) ?? (log.moderatorId ? 'AutoMod' : '');
      const target_name = name_by_id.get(log.userId) ?? log.userId;

      return {
        id: log.id,
        guildId: log.guildId,
        action: log.action.toUpperCase(),
        moderatorId: log.moderatorId,
        moderatorName: moderator_name,
        targetId: log.userId,
        targetName: target_name,
        userId: log.userId,
        reason: log.reason,
        duration: log.duration,
        metadata: log.metadata,
        createdAt: log.createdAt,
      };
    });

    return { logs: enriched, total };
  });

  // Buscar configuração de XP/Levels
  fastify.get('/:guildId/xp-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const config =
      (await prisma.guildXpConfig.findUnique({ where: { guildId } })) ??
      (await prisma.guildXpConfig.create({ data: { guildId } }));

    const rewards = await prisma.guildLevelRoleReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    });

    return { config, rewards };
  });

  // Buscar configuração de Autorole
  fastify.get('/:guildId/autorole-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const config =
      (await prisma.guildAutoroleConfig.findUnique({ where: { guildId } })) ??
      (await prisma.guildAutoroleConfig.create({ data: { guildId } }));

    const roles = await prisma.guildAutoroleRole.findMany({
      where: { guildId },
      orderBy: { roleId: 'asc' },
    });

    return {
      config,
      roleIds: roles.map((r) => r.roleId),
    };
  });

  // Atualizar configuração de Autorole
  fastify.put('/:guildId/autorole-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = guildAutoroleConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const data = parsed.data;
    const role_ids = data.roleIds;

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
      });

      if (role_ids) {
        await tx.guildAutoroleRole.deleteMany({ where: { guildId } });

        if (role_ids.length > 0) {
          await tx.guildAutoroleRole.createMany({
            data: role_ids.map((roleId) => ({
              guildId,
              roleId,
              configId: updated.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    const roles = await prisma.guildAutoroleRole.findMany({
      where: { guildId },
      orderBy: { roleId: 'asc' },
    });

    return { success: true, config, roleIds: roles.map((r) => r.roleId) };
  });

  // Atualizar configuração de XP/Levels
  fastify.put('/:guildId/xp-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = guildXpConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const data = parsed.data;
    const rewards = data.rewards;

    if (rewards && rewards.length > 15) {
      return reply.code(400).send({ error: 'reward limit exceeded (max 15)' });
    }

    const config = await prisma.$transaction(async (tx) => {
      const updated = await tx.guildXpConfig.upsert({
        where: { guildId },
        update: {
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
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
        },
        create: {
          guildId,
          enabled: data.enabled ?? true,
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
        },
      });

      if (rewards) {
        await tx.guildLevelRoleReward.deleteMany({ where: { guildId } });

        if (rewards.length > 0) {
          await tx.guildLevelRoleReward.createMany({
            data: rewards.map((r) => ({
              guildId,
              level: r.level,
              roleId: r.roleId,
            })),
          });
        }
      }

      return updated;
    });

    const updated_rewards = await prisma.guildLevelRoleReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    });

    return { success: true, config, rewards: updated_rewards };
  });

  // Leaderboard de XP local por guild
  fastify.get('/:guildId/xp-leaderboard', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { limit = 25, offset = 0 } = request.query as { limit?: number; offset?: number };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const rows = await prisma.guildXpMember.findMany({
      where: { guildId },
      orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.guildXpMember.count({ where: { guildId } });

    const ids = rows.map((r) => r.userId);
    const members = ids.length
      ? await prisma.guildMember.findMany({
          where: { guildId, userId: { in: ids } },
          select: { userId: true, username: true, avatar: true },
        })
      : [];

    const member_by_id = new Map(members.map((m) => [m.userId, m]));

    const leaderboard = rows.map((row, index) => {
      const info = member_by_id.get(row.userId);
      return {
        userId: row.userId,
        username: info?.username ?? row.userId,
        avatar: info?.avatar ?? null,
        xp: row.xp,
        level: row.level,
        position: Number(offset) + index + 1,
      };
    });

    return { leaderboard, total };
  });

  // Meu rank/XP na guild
  fastify.get('/:guildId/xp-me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const member = await prisma.guildXpMember.findUnique({
      where: {
        userId_guildId: {
          userId: user.userId,
          guildId,
        },
      },
    });

    if (!member) {
      return { xp: 0, level: 0, position: null };
    }

    const above = await prisma.guildXpMember.count({
      where: {
        guildId,
        xp: { gt: member.xp },
      },
    });

    return { xp: member.xp, level: member.level, position: above + 1 };
  });

  // Zerar XP (guild inteira ou usuário específico)
  fastify.post('/:guildId/xp-reset', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = xpResetSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { scope, userId } = parsed.data;

    if (scope === 'user' && !userId) {
      return reply.code(400).send({ error: 'userId is required for scope=user' });
    }

    const result = await prisma.guildXpMember.deleteMany({
      where: {
        guildId,
        ...(scope === 'user' ? { userId } : {}),
      },
    });

    return { success: true, deleted: result.count, scope };
  });

  // Buscar canais da guild (via Discord API seria melhor, mas por simplicidade retornamos vazio)
  fastify.get('/:guildId/channels', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const data = await get_guild_channels(guildId, request.log);
      return { channels: data.channels };
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to fetch channels from bot internal API');
      return reply.code(502).send({ error: 'Failed to fetch channels' });
    }
  });

  // Buscar roles da guild
  fastify.get('/:guildId/roles', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const data = await get_guild_roles(guildId, request.log);
      return { roles: data.roles };
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to fetch roles from bot internal API');
      return reply.code(502).send({ error: 'Failed to fetch roles' });
    }
  });
}
