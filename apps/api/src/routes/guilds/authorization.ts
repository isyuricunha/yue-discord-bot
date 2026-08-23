import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@yuebot/database'
import { is_guild_admin } from '../../internal/bot_internal_api'
import { can_access_guild, request_guild_id } from '../../utils/guild_access'
import { safe_error_details } from '../../utils/safe_error'

type guild_admin_checker = (
  guild_id: string,
  user_id: string,
  log: FastifyBaseLogger
) => Promise<{ isAdmin: boolean }>

type guild_route_authorization_deps = {
  guildExists: (guild_id: string) => Promise<boolean>
  isGuildAdmin: guild_admin_checker
}

type runtime_auth_user = {
  liveGuildAuthorizationChecked?: boolean
}

type authorization_mode = 'access' | 'admin'

async function default_guild_exists(guild_id: string) {
  const guild = await prisma.guild.findUnique({
    where: { id: guild_id },
    select: { id: true },
  })
  return Boolean(guild)
}

export function createGuildRouteAuthorization(
  overrides: Partial<guild_route_authorization_deps> = {}
) {
  const deps: guild_route_authorization_deps = {
    guildExists: overrides.guildExists ?? default_guild_exists,
    isGuildAdmin: overrides.isGuildAdmin ?? is_guild_admin,
  }

  async function authorize(
    mode: authorization_mode,
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const guild_id = request_guild_id(request.params)
    if (!guild_id) {
      await reply.code(400).send({ error: 'Invalid guild id' })
      return
    }

    if (!can_access_guild(request.user, guild_id)) {
      await reply.code(403).send({ error: 'Forbidden' })
      return
    }

    if (mode === 'admin' && !request.user.isOwner) {
      // The normal API pipeline already performs a live Discord admin lookup in
      // `authenticate`. Reuse that result instead of hitting the bot internal
      // API a second time. Isolated route tests/plugins still get the explicit
      // admin lookup that the old handlers performed themselves.
      const live_checked = (request.user as runtime_auth_user).liveGuildAuthorizationChecked === true
      if (!live_checked) {
        try {
          const { isAdmin } = await deps.isGuildAdmin(guild_id, request.user.userId, request.log)
          if (!isAdmin) {
            await reply.code(403).send({ error: 'Forbidden' })
            return
          }
        } catch (error: unknown) {
          request.log.warn(
            {
              err: safe_error_details(error),
              guildId: guild_id,
              userId: request.user.userId,
            },
            'Failed to verify guild admin authorization'
          )
          await reply.code(503).send({ error: 'Authorization unavailable' })
          return
        }
      }
    }

    if (!(await deps.guildExists(guild_id))) {
      await reply.code(404).send({ error: 'Guild not found' })
    }
  }

  return {
    requireGuildAccess(request: FastifyRequest, reply: FastifyReply) {
      return authorize('access', request, reply)
    },
    requireGuildAdmin(request: FastifyRequest, reply: FastifyReply) {
      return authorize('admin', request, reply)
    },
  }
}

export const { requireGuildAccess, requireGuildAdmin } = createGuildRouteAuthorization()
