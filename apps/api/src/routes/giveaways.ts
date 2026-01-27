import { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database';
import { createGiveawaySchema, generate_public_id, normalize_giveaway_items_list } from '@yuebot/shared';
import { safe_error_details } from '../utils/safe_error'
import { is_guild_admin } from '../internal/bot_internal_api'
import { send_guild_message } from '../internal/bot_internal_api'
import { can_access_guild } from '../utils/guild_access'
import { validation_error_details } from '../utils/validation_error'
import { public_error_message } from '../utils/public_error'

export default async function giveawayRoutes(fastify: FastifyInstance) {
  async function find_giveaway_by_identifier(input: { guildId: string; identifier: string; include?: Prisma.GiveawayInclude }) {
    const identifier = input.identifier

    const by_id = await prisma.giveaway.findUnique({
      where: { id: identifier },
      include: input.include,
    })

    if (by_id && by_id.guildId === input.guildId) return by_id

    return await prisma.giveaway.findFirst({
      where: { guildId: input.guildId, publicId: identifier },
      include: input.include,
    })
  }

  function is_public_id_conflict(error: unknown): boolean {
    const err = error as { code?: unknown; meta?: unknown }
    if (err?.code !== 'P2002') return false
    const meta = err.meta as { target?: unknown } | undefined
    const target = meta?.target
    if (Array.isArray(target)) return target.includes('publicId')
    if (typeof target === 'string') return target.includes('publicId')
    return false
  }

  async function create_giveaway_with_public_id(input: { data: Prisma.GiveawayCreateArgs['data'] }) {
    const attempts = 8
    let last_error: unknown = null

    for (let i = 0; i < attempts; i += 1) {
      const publicId = generate_public_id(10)
      try {
        return await prisma.giveaway.create({
          data: {
            ...input.data,
            publicId,
          },
        })
      } catch (error: unknown) {
        if (is_public_id_conflict(error)) {
          last_error = error
          continue
        }
        throw error
      }
    }

    throw last_error ?? new Error('Failed to generate unique publicId')
  }

  // Criar sorteio via Web
  fastify.post('/:guildId/giveaways', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;
    const parsed = createGiveawaySchema.safeParse(request.body);

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    const data = parsed.data;

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

    try {
      const normalized_items =
        data.format === 'list' && Array.isArray(data.availableItems)
          ? normalize_giveaway_items_list(data.availableItems)
          : null

      const required_role_ids =
        Array.isArray(data.requiredRoleIds) && data.requiredRoleIds.length > 0
          ? data.requiredRoleIds
          : typeof data.requiredRoleId === 'string' && data.requiredRoleId.trim().length > 0
            ? [data.requiredRoleId]
            : null

      if (data.format === 'list') {
        if (!normalized_items || normalized_items.length === 0) {
          return reply.code(400).send({ error: 'availableItems is required for list giveaways' })
        }

        const min = typeof data.minChoices === 'number' ? data.minChoices : null
        const max = typeof data.maxChoices === 'number' ? data.maxChoices : null

        if (min !== null && normalized_items.length < min) {
          return reply
            .code(400)
            .send({ error: `availableItems must contain at least ${min} items` })
        }

        if (max !== null && max > normalized_items.length) {
          return reply
            .code(400)
            .send({ error: 'maxChoices cannot be greater than the number of available items' })
        }
      }

      const giveaway = await create_giveaway_with_public_id({
        data: {
          guildId,
          title: data.title,
          description: data.description,
          channelId: data.channelId,
          messageId: null, // Será preenchido pelo bot
          creatorId: user.userId,
          requiredRoleId: data.requiredRoleId || null,
          requiredRoleIds: required_role_ids ? required_role_ids : Prisma.JsonNull,
          roleChances: data.roleChances ? data.roleChances : Prisma.JsonNull,
          maxWinners: data.maxWinners,
          format: data.format || 'reaction',
          availableItems: normalized_items ? normalized_items : Prisma.JsonNull,
          minChoices: data.minChoices || null,
          maxChoices: data.maxChoices || null,
          endsAt: data.endsAt,
          startsAt: data.startsAt ?? null,
        },
      })

      return { success: true, giveaway };
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to create giveaway');
      return reply.code(500).send({ error: public_error_message(fastify, 'Failed to create giveaway') });
    }
  });

  // Listar sorteios de uma guild
  fastify.get('/:guildId/giveaways', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const giveaways = await prisma.giveaway.findMany({
      where: { guildId },
      include: {
        _count: {
          select: {
            entries: { where: { disqualified: false } },
            winners: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, giveaways };
  });

  // Obter detalhes de um sorteio
  fastify.get('/:guildId/giveaways/:giveawayId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string };
    const user = request.user;

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const giveaway = await find_giveaway_by_identifier({
      guildId,
      identifier: giveawayId,
      include: {
        entries: {
          where: { disqualified: false },
          orderBy: { createdAt: 'desc' },
        },
        winners: true,
      },
    })

    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' });
    }

    return { success: true, giveaway };
  });

  // Cancelar sorteio
  fastify.post('/:guildId/giveaways/:giveawayId/cancel', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string };
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

    const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })
    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' });
    }

    if (giveaway.ended) {
      return reply.code(400).send({ error: 'Giveaway already ended' });
    }

    if (giveaway.cancelled) {
      return reply.code(400).send({ error: 'Giveaway already cancelled' });
    }

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { cancelled: true, ended: true, suspended: false },
    });

    await send_guild_message(guildId, giveaway.channelId, `🛑 **Sorteio cancelado:** ${giveaway.title}`, request.log)
      .catch((error) => {
        request.log.warn({ err: safe_error_details(error) }, 'Failed to notify giveaway cancellation')
      })

    return { success: true };
  });

  // Suspender sorteio
  fastify.post('/:guildId/giveaways/:giveawayId/suspend', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string };
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

    const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })
    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' })
    }

    if (giveaway.ended) {
      return reply.code(400).send({ error: 'Giveaway already ended' })
    }

    if (giveaway.suspended) {
      return reply.code(400).send({ error: 'Giveaway already suspended' })
    }

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { suspended: true },
    })

    await send_guild_message(guildId, giveaway.channelId, `⏸️ **Sorteio suspenso:** ${giveaway.title}`, request.log)
      .catch((error) => {
        request.log.warn({ err: safe_error_details(error) }, 'Failed to notify giveaway suspension')
      })

    return { success: true }
  })

  // Retomar sorteio
  fastify.post('/:guildId/giveaways/:giveawayId/resume', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string };
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

    const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })
    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' })
    }

    if (giveaway.ended) {
      return reply.code(400).send({ error: 'Giveaway already ended' })
    }

    if (!giveaway.suspended) {
      return reply.code(400).send({ error: 'Giveaway is not suspended' })
    }

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { suspended: false },
    })

    await send_guild_message(guildId, giveaway.channelId, `▶️ **Sorteio retomado:** ${giveaway.title}`, request.log)
      .catch((error) => {
        request.log.warn({ err: safe_error_details(error) }, 'Failed to notify giveaway resume')
      })

    return { success: true }
  })

  // Finalizar sorteio manualmente via painel
  fastify.post('/:guildId/giveaways/:giveawayId/end', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string };
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

    const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })
    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' })
    }

    if (giveaway.ended) {
      return reply.code(400).send({ error: 'Giveaway already ended' })
    }

    // Não marcamos ended=true aqui, porque o bot scheduler só processa sorteios com ended=false.
    // Ao trazer endsAt para "agora", o scheduler finaliza e apura vencedores normalmente.
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { endsAt: new Date(), cancelled: false, suspended: false },
    })

    // O bot scheduler vai calcular vencedores e anunciar em até 30s.
    await send_guild_message(
      guildId,
      giveaway.channelId,
      `🏁 **Sorteio marcado para finalizar:** ${giveaway.title}\nO bot irá apurar e anunciar os vencedores em instantes.`,
      request.log
    ).catch((error) => {
      request.log.warn({ err: safe_error_details(error) }, 'Failed to notify giveaway end request')
    })

    return { success: true }
  })

  // Adicionar participante manualmente
  fastify.post('/:guildId/giveaways/:giveawayId/entries', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string }
    const { userId, username, choices } = request.body as { userId: string; username: string; choices?: string[] }
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
      const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })

      if (!giveaway) {
        return reply.code(404).send({ error: 'Giveaway not found' })
      }

      if (giveaway.ended) {
        return reply.code(400).send({ error: 'O sorteio já acabou.' })
      }

      // Create entry
      const entry = await prisma.giveawayEntry.create({
        data: {
          giveawayId: giveaway.id,
          userId,
          username,
          choices: choices || Prisma.JsonNull,
        },
      })

      return reply.send({ success: true, ...entry })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to add giveaway entry')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Atualizar escolhas do participante
  fastify.patch('/:guildId/giveaways/:giveawayId/entries/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId, userId } = request.params as { guildId: string; giveawayId: string; userId: string }
    const { choices } = request.body as { choices: string[] }
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
      const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })

      if (!giveaway) {
        return reply.code(404).send({ error: 'Giveaway not found' })
      }

      if (giveaway.ended) {
        return reply.code(400).send({ error: 'O sorteio já acabou.' })
      }

      const entry = await prisma.giveawayEntry.update({
        where: {
          giveawayId_userId: {
            giveawayId: giveaway.id,
            userId,
          },
        },
        data: {
          choices,
        },
      })

      return reply.send({ success: true, ...entry })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to update giveaway entry choices')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Desqualificar participante
  fastify.post('/:guildId/giveaways/:giveawayId/entries/:userId/disqualify', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId, userId } = request.params as { 
      guildId: string; 
      giveawayId: string; 
      userId: string;
    };
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

    const giveaway = await find_giveaway_by_identifier({ guildId, identifier: giveawayId })
    if (!giveaway) {
      return reply.code(404).send({ error: 'Giveaway not found' })
    }

    await prisma.giveawayEntry.updateMany({
      where: {
        giveawayId: giveaway.id,
        userId,
      },
      data: { disqualified: true },
    });

    return { success: true };
  });
}
