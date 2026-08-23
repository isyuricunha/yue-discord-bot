import type { FastifyInstance } from 'fastify'
import { customCommandsRoutes } from './customCommands.routes'
import { musicRoutes } from './music.routes'
import { guildCommandsRoutes } from './guilds/commands.routes'
import { guildCommunityRoutes } from './guilds/community.routes'
import { guildCoreRoutes } from './guilds/core.routes'
import { guildModerationRoutes } from './guilds/moderation.routes'
import { guildSettingsRoutes } from './guilds/settings.routes'
import { guildXpRoutes } from './guilds/xp.routes'

export default async function guildRoutes(fastify: FastifyInstance) {
  fastify.register(guildCoreRoutes)
  fastify.register(guildSettingsRoutes)
  fastify.register(guildModerationRoutes)
  fastify.register(guildCommandsRoutes)
  fastify.register(guildXpRoutes)
  fastify.register(guildCommunityRoutes)
  fastify.register(musicRoutes)
  fastify.register(customCommandsRoutes)
}
