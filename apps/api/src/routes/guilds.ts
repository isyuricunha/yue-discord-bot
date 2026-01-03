import type { FastifyInstance } from 'fastify';
import { prisma } from '@yuebot/database';
import {
  autoModConfigSchema,
  guildAutoroleConfigSchema,
  guildXpConfigSchema,
  reactionRolePanelPublishSchema,
  reactionRolePanelUpsertSchema,
  starboardConfigSchema,
  suggestionConfigSchema,
  ticketConfigSchema,
  ticketPanelPublishSchema,
  xpResetSchema,
} from '@yuebot/shared';
import {
  get_guild_channels,
  get_guild_roles,
  get_bot_commands,
  is_guild_admin,
  publish_reaction_role_panel,
  publish_ticket_panel,
  send_guild_message,
} from '../internal/bot_internal_api';
import { safe_error_details } from '../utils/safe_error'
import { can_access_guild } from '../utils/guild_access'
import { validation_error_details } from '../utils/validation_error'
import { public_error_message } from '../utils/public_error'

export default async function guildRoutes(fastify: FastifyInstance) {
  const message_rate_limit = new Map<string, { count: number; windowStart: number }>();
  function can_send_message_now(user_id: string) {
    const window_ms = 10_000;
    const max_per_window = 5;

    const now = Date.now();

    // Best-effort pruning to avoid unbounded growth.
    // This is an in-memory limiter only; it is not intended to be perfectly precise.
    if (message_rate_limit.size > 5000) {
      const prune_before = now - Math.max(window_ms * 10, 60 * 60 * 1000);
      for (const [key, entry] of message_rate_limit.entries()) {
        if (entry.windowStart < prune_before) message_rate_limit.delete(key);
      }

      if (message_rate_limit.size > 10000) {
        message_rate_limit.clear();
      }
    }

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
        select: { id: true, name: true, icon: true, ownerId: true, addedAt: true },
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

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
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
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    const configData = parsed.data;

    // Verificar permissão
    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' })
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
        announcementChannelId: configData.announcementChannelId,
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

  // Listar comandos disponíveis no bot
  fastify.get('/:guildId/commands', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    try {
      const commands = await get_bot_commands(request.log)
      return reply.send({ success: true, ...commands })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to list bot commands')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

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
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
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

  // Buscar configuração de Tickets
  fastify.get('/:guildId/ticket-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const config = await prisma.ticketConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
        panelMessageId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        categoryId: config?.categoryId ?? null,
        logChannelId: config?.logChannelId ?? null,
        supportRoleIds: Array.isArray(config?.supportRoleIds) ? (config?.supportRoleIds as string[]) : [],
        panelChannelId: config?.panelChannelId ?? null,
        panelMessageId: config?.panelMessageId ?? null,
      },
    }
  })

  // Atualizar configuração de Tickets
  fastify.put('/:guildId/ticket-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = ticketConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const data = parsed.data

    const updated = await prisma.ticketConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
        ...(data.logChannelId !== undefined ? { logChannelId: data.logChannelId ?? null } : {}),
        ...(data.supportRoleIds !== undefined ? { supportRoleIds: data.supportRoleIds } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        categoryId: data.categoryId ?? null,
        logChannelId: data.logChannelId ?? null,
        supportRoleIds: data.supportRoleIds ?? [],
      },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
        panelMessageId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        categoryId: updated.categoryId,
        logChannelId: updated.logChannelId,
        supportRoleIds: Array.isArray(updated.supportRoleIds) ? (updated.supportRoleIds as string[]) : [],
        panelChannelId: updated.panelChannelId,
        panelMessageId: updated.panelMessageId,
      },
    }
  })

  // Buscar configuração de Suggestions
  fastify.get('/:guildId/suggestion-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const config = await prisma.suggestionConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        channelId: true,
        logChannelId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        channelId: config?.channelId ?? null,
        logChannelId: config?.logChannelId ?? null,
      },
    }
  })

  // Atualizar configuração de Suggestions
  fastify.put('/:guildId/suggestion-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user
    const parsed = suggestionConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const data = parsed.data

    const updated = await prisma.suggestionConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.channelId !== undefined ? { channelId: data.channelId ?? null } : {}),
        ...(data.logChannelId !== undefined ? { logChannelId: data.logChannelId ?? null } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        channelId: data.channelId ?? null,
        logChannelId: data.logChannelId ?? null,
      },
      select: {
        enabled: true,
        channelId: true,
        logChannelId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        channelId: updated.channelId,
        logChannelId: updated.logChannelId,
      },
    }
  })

  // Listar sugestões por guild
  fastify.get('/:guildId/suggestions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const query = request.query as { status?: string; limit?: string; cursor?: string }
    const status = query.status === 'pending' || query.status === 'accepted' || query.status === 'denied' ? query.status : undefined

    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25

    const cursor = typeof query.cursor === 'string' && query.cursor.trim().length > 0 ? query.cursor.trim() : undefined

    try {
      const items = await prisma.suggestion.findMany({
        where: {
          guildId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          sourceChannelId: true,
          sourceMessageId: true,
          messageId: true,
          content: true,
          status: true,
          upvotes: true,
          downvotes: true,
          decidedAt: true,
          decidedByUserId: true,
          decisionNote: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const nextCursor = items.length === limit ? items[items.length - 1]?.id : null

      return { success: true, suggestions: items, nextCursor }
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to list suggestions')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Listar painéis de Reaction Roles
  fastify.get('/:guildId/reaction-roles/panels', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const panels = await prisma.reactionRolePanel.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        enabled: true,
        mode: true,
        channelId: true,
        messageId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    })

    return {
      success: true,
      panels: panels.map((p) => ({
        ...p,
        itemsCount: p._count.items,
        _count: undefined,
      })),
    }
  })

  // Buscar painel de Reaction Roles
  fastify.get('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const panel = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        guildId: true,
        name: true,
        enabled: true,
        mode: true,
        channelId: true,
        messageId: true,
        createdAt: true,
        updatedAt: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, roleId: true, label: true, emoji: true, createdAt: true },
        },
      },
    })

    if (!panel || panel.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    return { success: true, panel }
  })

  // Criar painel de Reaction Roles
  fastify.post('/:guildId/reaction-roles/panels', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user
    const parsed = reactionRolePanelUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const data = parsed.data

    const created = await prisma.reactionRolePanel.create({
      data: {
        guildId,
        name: data.name,
        enabled: data.enabled ?? true,
        mode: data.mode ?? 'multiple',
        items: {
          create: data.items.map((i) => ({
            roleId: i.roleId,
            label: i.label ?? null,
            emoji: i.emoji ?? null,
          })),
        },
      },
      select: { id: true },
    })

    return reply.code(201).send({ success: true, panelId: created.id })
  })

  // Atualizar painel de Reaction Roles
  fastify.put('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const user = request.user
    const parsed = reactionRolePanelUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })

    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    const data = parsed.data

    await prisma.$transaction(async (tx) => {
      await tx.reactionRoleItem.deleteMany({ where: { panelId } })

      await tx.reactionRolePanel.update({
        where: { id: panelId },
        data: {
          name: data.name,
          enabled: data.enabled ?? true,
          mode: data.mode ?? 'multiple',
          items: {
            create: data.items.map((i) => ({
              roleId: i.roleId,
              label: i.label ?? null,
              emoji: i.emoji ?? null,
            })),
          },
        },
      })
    })

    return { success: true }
  })

  // Deletar painel de Reaction Roles
  fastify.delete('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })

    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    await prisma.reactionRolePanel.delete({ where: { id: panelId } })
    return { success: true }
  })

  // Publicar/atualizar painel de Reaction Roles via bot
  fastify.post('/:guildId/reaction-roles/panels/:panelId/publish', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const user = request.user
    const parsed = reactionRolePanelPublishSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })

    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    try {
      const res = await publish_reaction_role_panel(
        { guildId, panelId, channelId: parsed.data.channelId, moderatorId: user.userId },
        request.log
      )

      return reply.send({ success: true, messageId: res.messageId })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to publish reaction role panel via bot internal API')
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to publish reaction role panel', 'Bad gateway') })
    }
  })

  // Buscar configuração de Starboard
  fastify.get('/:guildId/starboard-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const config = await prisma.starboardConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        channelId: true,
        emoji: true,
        threshold: true,
        ignoreBots: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        channelId: config?.channelId ?? null,
        emoji: config?.emoji ?? '⭐',
        threshold: typeof config?.threshold === 'number' ? config.threshold : 3,
        ignoreBots: config?.ignoreBots ?? true,
      },
    }
  })

  // Atualizar configuração de Starboard
  fastify.put('/:guildId/starboard-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user
    const parsed = starboardConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const data = parsed.data

    const updated = await prisma.starboardConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.channelId !== undefined ? { channelId: data.channelId ?? null } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
        ...(data.ignoreBots !== undefined ? { ignoreBots: data.ignoreBots } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        channelId: data.channelId ?? null,
        emoji: data.emoji ?? '⭐',
        threshold: data.threshold ?? 3,
        ignoreBots: data.ignoreBots ?? true,
      },
      select: {
        enabled: true,
        channelId: true,
        emoji: true,
        threshold: true,
        ignoreBots: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        channelId: updated.channelId,
        emoji: updated.emoji,
        threshold: updated.threshold,
        ignoreBots: updated.ignoreBots,
      },
    }
  })

  // Listar posts do Starboard por guild
  fastify.get('/:guildId/starboard/posts', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const query = request.query as { limit?: string; cursor?: string }

    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25

    const cursor = typeof query.cursor === 'string' && query.cursor.trim().length > 0 ? query.cursor.trim() : undefined

    try {
      const items = await prisma.starboardPost.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          sourceChannelId: true,
          sourceMessageId: true,
          starboardChannelId: true,
          starboardMessageId: true,
          authorId: true,
          starCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const nextCursor = items.length === limit ? items[items.length - 1]?.id : null
      return { success: true, posts: items, nextCursor }
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to list starboard posts')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Listar tickets por guild
  fastify.get('/:guildId/tickets', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const query = request.query as { status?: string; limit?: string; cursor?: string }
    const status = query.status === 'open' || query.status === 'closed' ? query.status : undefined

    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25

    const cursor = typeof query.cursor === 'string' && query.cursor.trim().length > 0 ? query.cursor.trim() : undefined

    const items = await prisma.ticket.findMany({
      where: {
        guildId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        channelId: true,
        status: true,
        createdAt: true,
        closedAt: true,
        closedByUserId: true,
        closeReason: true,
      },
    })

    const nextCursor = items.length === limit ? items[items.length - 1]?.id : null

    return { success: true, tickets: items, nextCursor }
  })

  // Publicar/atualizar painel de tickets (mensagem com botão) via bot
  fastify.post('/:guildId/tickets/panel', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user
    const parsed = ticketPanelPublishSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    try {
      const res = await publish_ticket_panel(
        { guildId, channelId: parsed.data.channelId, moderatorId: user.userId },
        request.log
      )

      return reply.send({ success: true, messageId: res.messageId })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to publish ticket panel via bot internal API')
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to publish ticket panel', 'Bad gateway') })
    }
  })

  // Atualizar configuração de XP/Levels
  fastify.put('/:guildId/xp-config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = guildXpConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
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
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const installed = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!installed) {
      return reply.code(404).send({ error: 'Guild not found' })
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
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to fetch channels', 'Bad gateway') });
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
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to fetch roles', 'Bad gateway') });
    }
  });
}
