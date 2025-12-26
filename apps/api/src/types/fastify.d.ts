import type { FastifyReply, FastifyRequest } from 'fastify'
import 'fastify'
import '@fastify/jwt'

type jwt_guild_data = {
  id: string
  name: string
  icon: string | null
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      username: string
      discriminator: string
      avatar: string | null
      guilds: string[]
      guildsData: jwt_guild_data[]
      isOwner: boolean
    }
    user: {
      userId: string
      username: string
      discriminator: string
      avatar: string | null
      guilds: string[]
      guildsData: jwt_guild_data[]
      isOwner: boolean
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    config: {
      admin: {
        badgeAdminUserIds: string[]
        fanArtReviewerUserIds: string[]
        globalXpResetUserIds: string[]
        ownerUserIds: string[]
      }
    }
  }
}
