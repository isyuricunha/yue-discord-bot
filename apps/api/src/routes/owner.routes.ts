import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'

import { InternalBotApiError, send_guild_message } from '../internal/bot_internal_api'
import { is_owner } from '../utils/permissions'
import { safe_error_details } from '../utils/safe_error'

type announcement_preview_input = {
  content: string
  query?: string
  addedFrom?: string
  addedTo?: string
}

type announcement_preview_target = {
  guildId: string
  guildName: string
  channelId: string
}

function is_object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
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

type announcement_preview_skipped = {
  guildId: string
  guildName: string
  reason: string
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

    for (const g of guilds) {
      if (!in_range(g.addedAt, from_date, to_date)) continue
      if (!matches_query({ id: g.id, name: g.name, ownerId: g.ownerId }, input.query)) continue

      const announcement_channel_id = g.config?.announcementChannelId ?? null
      const fallback_modlog_id = g.config?.modLogChannelId ?? null
      const channel_id = announcement_channel_id ?? fallback_modlog_id

      if (!channel_id) {
        skipped.push({ guildId: g.id, guildName: g.name, reason: 'No announcement channel configured' })
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

    return reply.send({ previewId: log.id, preview })
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
