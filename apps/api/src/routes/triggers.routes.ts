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

function parseKeywords(input: string | string[]): string[] {
  if (Array.isArray(input)) {
    return input
      .map(k => k.toLowerCase().trim())
      .filter(k => k.length > 0 && k.length <= 100)
  }

  // Handle string input (backwards compatibility + multi-line support)
  return input
    .split(/\r?\n/)
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length > 0 && k.length <= 100)
}

const createTriggerSchema = z.object({
  keyword: z.union([z.string().min(1), z.array(z.string().min(1).max(100))]).optional(),
  keywords: z.union([z.string().min(1), z.array(z.string().min(1).max(100))]).optional(),
  mediaUrl: z.union([z.string().url(), z.null(), z.undefined()]),
  content: z.string().max(2000).optional().nullable(),
  channelId: z.string().optional().nullable(),
  replyToUser: z.boolean().optional().default(true),
}).refine(data => data.keyword || data.keywords, {
  message: "Either keyword or keywords must be provided",
  path: ["keyword"]
})

const updateTriggerSchema = z.object({
  keyword: z.union([z.string().min(1), z.array(z.string().min(1).max(100))]).optional(),
  keywords: z.union([z.string().min(1), z.array(z.string().min(1).max(100))]).optional(),
  mediaUrl: z.union([z.string().url(), z.null(), z.undefined()]).optional(),
  content: z.string().max(2000).optional().nullable(),
  channelId: z.string().optional().nullable(),
  replyToUser: z.boolean().optional(),
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

      const keywords = parseKeywords(body.keywords || body.keyword)

      if (keywords.length === 0) {
        return reply.code(400).send({ error: 'É necessário informar pelo menos uma palavra-chave válida.' })
      }

      // Validate uniqueness for all keywords
      for (const keyword of keywords) {
        const existing = await prisma.keywordTrigger.findFirst({
          where: {
            guildId,
            OR: [
              { keyword },
              { keywords: { has: keyword } }
            ]
          }
        })

        if (existing) {
          return reply.code(409).send({ error: `Já existe um gatilho com a palavra "${keyword}".` })
        }
      }

      if (existing) {
        return reply.code(409).send({ error: `Já existe um gatilho com a palavra "${keyword}".` })
      }

      if (!body.mediaUrl && !body.content) {
        return reply.code(400).send({ error: 'Você precisa informar pelo menos uma URL ou um Texto.' })
      }

      const trigger = await prisma.keywordTrigger.create({
        data: {
          guildId,
          keyword: keywords[0],
          keywords,
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

  // PUT /:guildId/triggers/:triggerId
  fastify.put(
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

      const body = updateTriggerSchema.parse(request.body)

      if (body.mediaUrl && !validate_media_url(body.mediaUrl)) {
        return reply.code(400).send({
          error:
            'URL inválida ou do domínio não permitido. Aceito apenas URLs https de domínios confiáveis ou com extensão de mídia conhecida.',
        })
      }

      const existing_trigger = await prisma.keywordTrigger.findUnique({
        where: { id: triggerId },
      })

      if (!existing_trigger || existing_trigger.guildId !== guildId) {
        return reply.code(404).send({ error: 'Gatilho não encontrado.' })
      }

      const keywords = parseKeywords(body.keywords || body.keyword || existing_trigger.keywords || existing_trigger.keyword)

      if (keywords.length === 0) {
        return reply.code(400).send({ error: 'É necessário informar pelo menos uma palavra-chave válida.' })
      }

      // Validate uniqueness for all keywords
      for (const keyword of keywords) {
        const existing = await prisma.keywordTrigger.findFirst({
          where: {
            guildId,
            id: { not: triggerId },
            OR: [
              { keyword },
              { keywords: { has: keyword } }
            ]
          }
        })

        if (existing) {
          return reply.code(409).send({ error: `A palavra "${keyword}" já está em uso por outro gatilho.` })
        }
      }

      if (!body.mediaUrl && !body.content && !existing_trigger.mediaUrl && !existing_trigger.content) {
        return reply.code(400).send({ error: 'Você precisa informar pelo menos uma URL ou um Texto.' })
      }

      const update_data: any = {
        keyword: keywords[0],
        keywords,
        updatedAt: new Date(),
      }

      if (body.mediaUrl !== undefined) update_data.mediaUrl = body.mediaUrl || null
      if (body.content !== undefined) update_data.content = body.content || null
      if (body.channelId !== undefined) update_data.channelId = body.channelId || null
      if (body.replyToUser !== undefined) update_data.replyToUser = body.replyToUser

      const trigger = await prisma.keywordTrigger.update({
        where: { id: triggerId },
        data: update_data,
      })

      return reply.send({ success: true, trigger })
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
