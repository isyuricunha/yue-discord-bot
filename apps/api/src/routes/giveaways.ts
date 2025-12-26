import { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database';
import { createGiveawaySchema } from '@yuebot/shared';
import { safe_error_details } from '../utils/safe_error'
import { can_access_guild } from '../utils/guild_access'
import { validation_error_details } from '../utils/validation_error'
import { public_error_message } from '../utils/public_error'

export default async function giveawayRoutes(fastify: FastifyInstance) {
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

    try {
      const giveaway = await prisma.giveaway.create({
        data: {
          guildId,
          title: data.title,
          description: data.description,
          channelId: data.channelId,
          messageId: null, // Será preenchido pelo bot
          creatorId: user.userId,
          requiredRoleId: data.requiredRoleId || null,
          maxWinners: data.maxWinners,
          format: data.format || 'reaction',
          availableItems: data.availableItems ? data.availableItems : Prisma.JsonNull,
          minChoices: data.minChoices || null,
          maxChoices: data.maxChoices || null,
          endsAt: data.endsAt,
          startsAt: data.startsAt ?? null,
        },
      });

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

    return { giveaways };
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

    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: {
        entries: {
          where: { disqualified: false },
          orderBy: { createdAt: 'desc' },
        },
        winners: true,
      },
    });

    if (!giveaway || giveaway.guildId !== guildId) {
      return reply.code(404).send({ error: 'Giveaway not found' });
    }

    return { giveaway };
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

    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
    });

    if (!giveaway || giveaway.guildId !== guildId) {
      return reply.code(404).send({ error: 'Giveaway not found' });
    }

    if (giveaway.ended) {
      return reply.code(400).send({ error: 'Giveaway already ended' });
    }

    await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { cancelled: true, ended: true },
    });

    return { success: true };
  });

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

    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayId },
      })

      if (!giveaway || giveaway.guildId !== guildId) {
        return reply.code(404).send({ error: 'Giveaway not found' })
      }

      if (giveaway.ended) {
        return reply.code(400).send({ error: 'Giveaway has already ended' })
      }

      // Create entry
      const entry = await prisma.giveawayEntry.create({
        data: {
          giveawayId,
          userId,
          username,
          choices: choices || Prisma.JsonNull,
        },
      })

      return reply.send(entry)
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

    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayId },
      })

      if (!giveaway || giveaway.guildId !== guildId) {
        return reply.code(404).send({ error: 'Giveaway not found' })
      }

      if (giveaway.ended) {
        return reply.code(400).send({ error: 'Giveaway has already ended' })
      }

      const entry = await prisma.giveawayEntry.update({
        where: {
          giveawayId_userId: {
            giveawayId,
            userId,
          },
        },
        data: {
          choices,
        },
      })

      return reply.send(entry)
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

    await prisma.giveawayEntry.updateMany({
      where: {
        giveawayId,
        userId,
      },
      data: { disqualified: true },
    });

    return { success: true };
  });
}
