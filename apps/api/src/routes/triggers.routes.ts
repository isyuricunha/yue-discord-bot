import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@yuebot/database'
import { z } from 'zod'
import { can_access_guild } from '../utils/guild_access'
import { is_guild_admin } from '../internal/bot_internal_api'

const ALLOWED_DOMAINS = [
  'tenor.com',
  'giphy.com',
  'imgur.com',
  'i.imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'youtube.com',
  'youtu.be',
  'spotify.com',
  'open.spotify.com',
]
const ALLOWED_EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4']

function validate_media_url(raw: string | null | undefined): boolean {
  if (!raw) return true // Se for nulo/vazio, é considerado válido (não bloqueia)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()
  const is_allowed_domain = ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  )
  if (is_allowed_domain) return true

  const path_without_query = url.pathname.split('?')[0] ?? ''
  const ext = path_without_query.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXTENSIONS.includes(ext)
}

const paramsSchema = z.object({ guildId: z.string() })

const createTriggerSchema = z.object({
  keyword: z.string().min(1).max(100),
  mediaUrl: z.union([z.string().url(), z.null(), z.undefined()]),
  content: z.string().max(2000).optional().nullable(),
  channelId: z.string().optional().nullable(),
  replyToUser: z.boolean().optional().default(true),
})

export const triggersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /:guildId/triggers
  fastify.get(
    '/:guildId/triggers',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { guildId } = paramsSchema.parse(request.params)
      const user = request.user

      if (!can_access_guild(user, guildId)) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const triggers = await prisma.keywordTrigger.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({ success: true, triggers })
    }
  )

  // POST /:guildId/triggers
  fastify.post(
    '/:guildId/triggers',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { guildId } = paramsSchema.parse(request.params)
      const user = request.user

      if (!can_access_guild(user, guildId)) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!user.isOwner && !isAdmin) {
        return reply.code(403).send({ error: 'Você precisa da permissão Gerenciar Servidor.' })
      }

      const body = createTriggerSchema.parse(request.body)

      if (body.mediaUrl && !validate_media_url(body.mediaUrl)) {
        return reply.code(400).send({
          error:
            'URL inválida ou do domínio não permitido. Aceito apenas URLs https de domínios confiáveis ou com extensão de mídia conhecida.',
        })
      }

      const keyword = body.keyword.toLowerCase().trim()

      const existing = await prisma.keywordTrigger.findUnique({
        where: { guildId_keyword: { guildId, keyword } },
      })

      if (existing) {
        return reply.code(409).send({ error: `Já existe um gatilho com a palavra "${keyword}".` })
      }

      if (!body.mediaUrl && !body.content) {
        return reply.code(400).send({ error: 'Você precisa informar pelo menos uma URL ou um Texto.' })
      }

      const trigger = await prisma.keywordTrigger.create({
        data: {
          guildId,
          keyword,
          mediaUrl: body.mediaUrl || null,
          content: body.content || null,
          channelId: body.channelId ?? null,
          createdBy: user.userId,
          replyToUser: body.replyToUser,
        },
      })

      return reply.code(201).send({ success: true, trigger })
    }
  )

  // DELETE /:guildId/triggers/:triggerId
  fastify.delete(
    '/:guildId/triggers/:triggerId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { guildId, triggerId } = z
        .object({ guildId: z.string(), triggerId: z.string() })
        .parse(request.params)
      const user = request.user

      if (!can_access_guild(user, guildId)) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!user.isOwner && !isAdmin) {
        return reply.code(403).send({ error: 'Você precisa da permissão Gerenciar Servidor.' })
      }

      const trigger = await prisma.keywordTrigger.findUnique({
        where: { id: triggerId },
      })

      if (!trigger || trigger.guildId !== guildId) {
        return reply.code(404).send({ error: 'Gatilho não encontrado.' })
      }

      await prisma.keywordTrigger.delete({ where: { id: triggerId } })

      return reply.code(204).send()
    }
  )
}
