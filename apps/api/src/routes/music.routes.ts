import { FastifyInstance } from 'fastify'
import { get_guild_music_status, execute_music_action, music_action_body } from '../internal/bot_internal_api';
import { can_access_guild } from '../utils/guild_access'
import { is_guild_admin } from '../internal/bot_internal_api';

export async function musicRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/:guildId/music',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
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

      const status = await get_guild_music_status(guildId, request.log);
      return status;
    }
  );

  fastify.post(
    '/:guildId/music/action',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as music_action_body;
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

      if (!['pause', 'resume', 'skip', 'stop', 'volume'].includes(body.action)) {
        return reply.code(400).send({ error: 'Invalid action' });
      }

      const result = await execute_music_action(guildId, body, request.log);
      return result;
    }
  );
}
