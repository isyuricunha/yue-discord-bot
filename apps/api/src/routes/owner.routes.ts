import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'

import {
  InternalBotApiError,
  get_guild_info,
  send_guild_message,
  set_bot_app_description,
  set_bot_presence,
} from '../internal/bot_internal_api'
import { is_owner } from '../utils/permissions'
import { safe_error_details } from '../utils/safe_error'

type announcement_preview_input = {
  content: string
  query?: string
  addedFrom?: string
  addedTo?: string
}

type bot_presence_settings = {
  presenceEnabled: boolean
  presenceStatus: 'online' | 'idle' | 'dnd' | 'invisible'
  activityType: 'playing' | 'streaming' | 'listening' | 'watching' | 'competing' | null
  activityName: string | null
  activityUrl: string | null
}

type bot_app_description_settings = {
  appDescription: string | null
}

function parse_presence_status(value: unknown): bot_presence_settings['presenceStatus'] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'online' || raw === 'idle' || raw === 'dnd' || raw === 'invisible') return raw
  return 'online'
}

function parse_activity_type(value: unknown): bot_presence_settings['activityType'] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'playing' || raw === 'streaming' || raw === 'listening' || raw === 'watching' || raw === 'competing') return raw
  return null
}

function normalize_optional_string(value: unknown, max_len: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max_len ? trimmed.slice(0, max_len) : trimmed
}

function normalize_optional_url(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function parse_bot_presence_settings(body: unknown): bot_presence_settings | null {
  if (!is_object(body)) return null

  if (typeof body.presenceEnabled !== 'boolean') return null

  const presenceStatus = parse_presence_status(body.presenceStatus)
  const activityType = parse_activity_type(body.activityType)
  const activityName = normalize_optional_string(body.activityName, 128)
  const activityUrl = normalize_optional_url(body.activityUrl)

  if (activityType === 'streaming' && activityName && !activityUrl) return null

  return {
    presenceEnabled: body.presenceEnabled,
    presenceStatus,
    activityType,
    activityName,
    activityUrl,
  }
}

function parse_bot_app_description_settings(body: unknown): bot_app_description_settings | null {
  if (!is_object(body)) return null

  const raw = body.appDescription
  if (raw === null || raw === undefined) return { appDescription: null }

  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return { appDescription: null }
  if (trimmed.length > 4000) return null

  return { appDescription: trimmed }
}

type announcement_preview_target = {
  guildId: string
  guildName: string
  channelId: string
}

function is_object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function internal_bot_api_error_message(error: InternalBotApiError) {
  const body = error.body
  if (body && typeof body === 'object' && 'error' in body && typeof (body as Record<string, unknown>).error === 'string') {
    return String((body as Record<string, unknown>).error)
  }
  return `Internal bot API returned ${error.status}`
}

function parse_preview_input(body: unknown): announcement_preview_input | null {
  if (!is_object(body)) return null

  const content_raw = body.content
  const content = typeof content_raw === 'string' ? content_raw.trim() : ''
  if (!content) return null
  if (content.length > 2000) return null

  const query = typeof body.query === 'string' ? body.query.trim() : undefined
  const addedFrom = typeof body.addedFrom === 'string' ? body.addedFrom.trim() : undefined
  const addedTo = typeof body.addedTo === 'string' ? body.addedTo.trim() : undefined

  if (addedFrom && !/^\d{4}-\d{2}-\d{2}$/.test(addedFrom)) return null
  if (addedTo && !/^\d{4}-\d{2}-\d{2}$/.test(addedTo)) return null

  return {
    content,
    ...(query ? { query } : {}),
    ...(addedFrom ? { addedFrom } : {}),
    ...(addedTo ? { addedTo } : {}),
  }
}

function sleep_ms(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function map_with_concurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  const pending = items.slice()

  const worker = async () => {
    while (pending.length > 0) {
      const item = pending.shift()
      if (item === undefined) return
      results.push(await fn(item))
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }).map(() => worker()))
  return results
}

type announcement_preview_skipped = {
  guildId: string
  guildName: string
  reason: string
}

function first_string(...values: Array<string | null | undefined>) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  return null
}

function parse_date_input(value?: string) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function in_range(added_at: Date, from: Date | null, to: Date | null) {
  if (!from && !to) return true
  if (from && added_at < from) return false
  if (to) {
    const end = new Date(to)
    end.setUTCDate(end.getUTCDate() + 1)
    if (added_at >= end) return false
  }
  return true
}

function matches_query(input: { id: string; name: string; ownerId: string }, query?: string) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
  if (!q) return true

  return (
    input.id.toLowerCase().includes(q) ||
    input.name.toLowerCase().includes(q) ||
    input.ownerId.toLowerCase().includes(q)
  )
}

export async function ownerRoutes(fastify: FastifyInstance) {
  fastify.get('/owner/bot/app-description', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const row = await prisma.botSettings.findUnique({
      where: { id: 'global' },
      select: { appDescription: true },
    })

    return reply.send({
      success: true,
      appDescription: typeof row?.appDescription === 'string' ? row.appDescription : null,
    })
  })

  fastify.put('/owner/bot/app-description', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const input = parse_bot_app_description_settings(request.body)
    if (!input) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const saved = await prisma.botSettings.upsert({
      where: { id: 'global' },
      update: { appDescription: input.appDescription ?? null },
      create: { id: 'global', appDescription: input.appDescription ?? null },
      select: { appDescription: true },
    })

    try {
      await set_bot_app_description({ appDescription: saved.appDescription ?? null }, request.log)
    } catch (error: unknown) {
      if (error instanceof InternalBotApiError) {
        if (error.status >= 400 && error.status < 500) {
          return reply.code(error.status).send({ error: internal_bot_api_error_message(error) })
        }
        request.log.error({ err: safe_error_details(error), status: error.status }, 'Failed to apply bot app description via internal bot API')
        return reply.code(502).send({ error: 'Bad gateway' })
      }

      request.log.error({ err: safe_error_details(error) }, 'Failed to apply bot app description')
      return reply.code(500).send({ error: 'Internal server error' })
    }

    return reply.send({ success: true, appDescription: saved.appDescription ?? null })
  })

  fastify.get('/owner/bot/presence', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const row = await prisma.botSettings.findUnique({
      where: { id: 'global' },
      select: {
        presenceEnabled: true,
        presenceStatus: true,
        activityType: true,
        activityName: true,
        activityUrl: true,
      },
    })

    const presence: bot_presence_settings = {
      presenceEnabled: row?.presenceEnabled ?? false,
      presenceStatus: parse_presence_status(row?.presenceStatus),
      activityType: parse_activity_type(row?.activityType),
      activityName: typeof row?.activityName === 'string' ? row.activityName : null,
      activityUrl: typeof row?.activityUrl === 'string' ? row.activityUrl : null,
    }

    return reply.send({ success: true, presence })
  })

  fastify.put('/owner/bot/presence', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const input = parse_bot_presence_settings(request.body)
    if (!input) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const saved = await prisma.botSettings.upsert({
      where: { id: 'global' },
      update: {
        presenceEnabled: input.presenceEnabled,
        presenceStatus: input.presenceStatus,
        activityType: input.activityType,
        activityName: input.activityName,
        activityUrl: input.activityUrl,
      },
      create: {
        id: 'global',
        presenceEnabled: input.presenceEnabled,
        presenceStatus: input.presenceStatus,
        activityType: input.activityType,
        activityName: input.activityName,
        activityUrl: input.activityUrl,
      },
      select: {
        presenceEnabled: true,
        presenceStatus: true,
        activityType: true,
        activityName: true,
        activityUrl: true,
      },
    })

    try {
      await set_bot_presence(
        {
          presenceEnabled: saved.presenceEnabled,
          presenceStatus: parse_presence_status(saved.presenceStatus),
          activityType: parse_activity_type(saved.activityType),
          activityName: typeof saved.activityName === 'string' ? saved.activityName : null,
          activityUrl: typeof saved.activityUrl === 'string' ? saved.activityUrl : null,
        },
        request.log
      )
    } catch (error: unknown) {
      if (error instanceof InternalBotApiError) {
        if (error.status >= 400 && error.status < 500) {
          return reply.code(error.status).send({ error: internal_bot_api_error_message(error) })
        }
        request.log.error({ err: safe_error_details(error), status: error.status }, 'Failed to apply bot presence via internal bot API')
        return reply.code(502).send({ error: 'Bad gateway' })
      }

      request.log.error({ err: safe_error_details(error) }, 'Failed to apply bot presence')
      return reply.code(500).send({ error: 'Internal server error' })
    }

    const presence: bot_presence_settings = {
      presenceEnabled: saved.presenceEnabled,
      presenceStatus: parse_presence_status(saved.presenceStatus),
      activityType: parse_activity_type(saved.activityType),
      activityName: typeof saved.activityName === 'string' ? saved.activityName : null,
      activityUrl: typeof saved.activityUrl === 'string' ? saved.activityUrl : null,
    }

    return reply.send({ success: true, presence })
  })

  fastify.post('/owner/guilds/:guildId/sync', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const { guildId } = request.params as { guildId?: string }
    if (typeof guildId !== 'string' || !guildId.trim()) {
      return reply.code(400).send({ error: 'Invalid guildId' })
    }

    try {
      const info = await get_guild_info(guildId, request.log)
      const g = info.guild

      const guild = await prisma.guild.upsert({
        where: { id: g.id },
        update: {
          name: g.name,
          icon: g.icon,
          ownerId: g.ownerId,
        },
        create: {
          id: g.id,
          name: g.name,
          icon: g.icon,
          ownerId: g.ownerId,
        },
      })

      await prisma.ownerActionLog.create({
        data: {
          actorUserId: user.userId,
          type: 'sync_guild',
          status: 'executed',
          request: { guildId: g.id },
          result: {
            guild: {
              id: guild.id,
              name: guild.name,
              icon: guild.icon,
              ownerId: guild.ownerId,
              addedAt: guild.addedAt,
            },
            internal: {
              systemChannelId: g.systemChannelId,
            },
          },
          executedAt: new Date(),
        },
      })

      return reply.send({ success: true, guild })
    } catch (error: unknown) {
      if (error instanceof InternalBotApiError) {
        if (error.status === 404) {
          const result = await prisma.guild.deleteMany({ where: { id: guildId } })

          await prisma.ownerActionLog.create({
            data: {
              actorUserId: user.userId,
              type: 'sync_guild',
              status: 'failed',
              request: { guildId },
              result: {
                error: 'Guild not found',
                removed: result.count > 0,
              },
              executedAt: new Date(),
            },
          })

          return reply.code(404).send({ error: 'Guild not found', removed: result.count > 0 })
        }

        if (error.status >= 400 && error.status < 500) {
          return reply.code(error.status).send({ error: internal_bot_api_error_message(error) })
        }
        request.log.error({ err: safe_error_details(error), status: error.status }, 'Failed to sync guild via internal bot API')
        return reply.code(502).send({ error: 'Bad gateway' })
      }

      request.log.error({ err: safe_error_details(error) }, 'Failed to sync guild')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.post('/owner/announcements/preview', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const input = parse_preview_input(request.body)
    if (!input) return reply.code(400).send({ error: 'Invalid body' })

    const from_date = parse_date_input(input.addedFrom)
    const to_date = parse_date_input(input.addedTo)

    const guilds = await prisma.guild.findMany({
      include: {
        config: {
          select: {
            announcementChannelId: true,
            modLogChannelId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const targets: announcement_preview_target[] = []
    const skipped: announcement_preview_skipped[] = []

    const filtered_guilds = guilds.filter((g) => {
      if (!in_range(g.addedAt, from_date, to_date)) return false
      if (!matches_query({ id: g.id, name: g.name, ownerId: g.ownerId }, input.query)) return false
      return true
    })

    const info_required = filtered_guilds
      .filter((g) => !(g.config?.announcementChannelId ?? null))
      .map((g) => g.id)

    const info_rows = await map_with_concurrency(info_required, 8, async (guild_id) => {
      const info = await get_guild_info(guild_id, request.log).then((r) => r.guild).catch(() => null)
      return { guildId: guild_id, info }
    })

    const info_by_guild_id = new Map(info_rows.map((r) => [r.guildId, r.info]))

    for (const g of filtered_guilds) {
      const announcement_channel_id = g.config?.announcementChannelId ?? null
      const fallback_modlog_id = g.config?.modLogChannelId ?? null

      const info = announcement_channel_id ? null : (info_by_guild_id.get(g.id) ?? null)

      const channel_id = first_string(
        announcement_channel_id,
        info?.publicUpdatesChannelId ?? null,
        info?.rulesChannelId ?? null,
        info?.systemChannelId ?? null,
        fallback_modlog_id
      )

      if (!channel_id) {
        skipped.push({ guildId: g.id, guildName: g.name, reason: 'No suitable channel found' })
        continue
      }

      targets.push({ guildId: g.id, guildName: g.name, channelId: channel_id })
    }

    const preview = {
      total: targets.length + skipped.length,
      sendable: targets.length,
      skipped: skipped.length,
      targets,
      skippedItems: skipped,
    }

    if (preview.sendable > 500) {
      return reply.code(400).send({ error: 'Preview too large (sendable > 500). Narrow the filters.' })
    }

    const log = await prisma.ownerActionLog.create({
      data: {
        actorUserId: user.userId,
        type: 'announcement',
        status: 'preview',
        request: {
          content: input.content,
          query: input.query ?? null,
          addedFrom: input.addedFrom ?? null,
          addedTo: input.addedTo ?? null,
        },
        preview,
      },
    })

    return reply.send({ success: true, previewId: log.id, preview })
  })

  fastify.post('/owner/announcements/execute', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user
    if (!is_owner(user.userId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const body = request.body as { previewId?: string; confirm?: string; expectedSendable?: number }
    const preview_id = typeof body?.previewId === 'string' ? body.previewId : ''
    const confirm = typeof body?.confirm === 'string' ? body.confirm : ''
    const expected_sendable = typeof body?.expectedSendable === 'number' ? body.expectedSendable : null

    if (!preview_id.trim()) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    if (confirm !== 'CONFIRMAR') {
      return reply.code(400).send({ error: 'Confirmation required' })
    }

    if (expected_sendable === null || !Number.isFinite(expected_sendable) || expected_sendable < 0) {
      return reply.code(400).send({ error: 'expectedSendable is required' })
    }

    const existing = await prisma.ownerActionLog.findUnique({ where: { id: preview_id } })
    if (!existing) {
      return reply.code(404).send({ error: 'Preview not found' })
    }

    if (existing.type !== 'announcement' || existing.status !== 'preview') {
      return reply.code(400).send({ error: 'Invalid preview state' })
    }

    if (existing.actorUserId !== user.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const request_payload = existing.request as { content?: unknown }
    const content = typeof request_payload?.content === 'string' ? request_payload.content : ''
    if (!content.trim() || content.length > 2000) {
      return reply.code(400).send({ error: 'Invalid preview content' })
    }

    const preview_payload = existing.preview as {
      targets?: unknown
      skippedItems?: unknown
    } | null

    const targets = Array.isArray(preview_payload?.targets)
      ? (preview_payload?.targets as announcement_preview_target[])
      : []

    if (targets.length !== expected_sendable) {
      return reply.code(400).send({ error: 'Preview mismatch (expectedSendable does not match preview)' })
    }

    if (targets.length > 500) {
      return reply.code(400).send({ error: 'Too many targets. Narrow the filters.' })
    }

    const claimed = await prisma.ownerActionLog.updateMany({
      where: {
        id: existing.id,
        status: 'preview',
      },
      data: {
        status: 'executing',
      },
    })

    if (claimed.count !== 1) {
      return reply.code(409).send({ error: 'Preview already executed' })
    }

    const results: Array<
      | { guildId: string; guildName: string; channelId: string; status: 'sent'; messageId: string }
      | { guildId: string; guildName: string; channelId: string; status: 'failed'; error: string }
    > = []

    const concurrency = 4
    const pending = targets.slice()

    const worker = async () => {
      while (pending.length > 0) {
        const t = pending.shift()
        if (!t) return

        try {
          const sent = await send_guild_message(t.guildId, t.channelId, content, request.log)
          results.push({
            guildId: t.guildId,
            guildName: t.guildName,
            channelId: t.channelId,
            status: 'sent',
            messageId: sent.messageId,
          })
        } catch (error: unknown) {
          if (error instanceof InternalBotApiError) {
            const upstream_error =
              error.body &&
              typeof error.body === 'object' &&
              'error' in error.body &&
              typeof (error.body as Record<string, unknown>).error === 'string'
                ? String((error.body as Record<string, unknown>).error)
                : `Internal bot API returned ${error.status}`

            results.push({
              guildId: t.guildId,
              guildName: t.guildName,
              channelId: t.channelId,
              status: 'failed',
              error: upstream_error,
            })
          } else {
            request.log.error({ err: safe_error_details(error), guildId: t.guildId }, 'Failed to send announcement')
            results.push({
              guildId: t.guildId,
              guildName: t.guildName,
              channelId: t.channelId,
              status: 'failed',
              error: 'Unknown error',
            })
          }
        }

        await sleep_ms(250)
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }).map(() => worker()))

    const sent_count = results.filter((r) => r.status === 'sent').length
    const failed_count = results.filter((r) => r.status === 'failed').length

    const result_payload = {
      total: results.length,
      sent: sent_count,
      failed: failed_count,
      results,
    }

    await prisma.ownerActionLog.update({
      where: { id: existing.id },
      data: {
        status: 'executed',
        executedAt: new Date(),
        result: result_payload,
      },
    })

    return reply.send({ success: true, result: result_payload })
  })
}
