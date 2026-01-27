import type { FastifyInstance } from 'fastify'
import { Prisma, prisma } from '@yuebot/database'
import {
  match_giveaway_choices,
  normalize_giveaway_items_list,
  parse_giveaway_choices_input,
} from '@yuebot/shared'

function normalize_token(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : null
}

function get_choices_from_body(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null

  const maybe = body as { choices?: unknown; choicesText?: unknown }

  if (typeof maybe.choicesText === 'string') {
    return parse_giveaway_choices_input(maybe.choicesText)
  }

  if (Array.isArray(maybe.choices)) {
    return maybe.choices
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c) => c.length > 0)
  }

  return null
}

function dedupe_preserve_order(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const v of values) {
    const key = String(v).trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }

  return out
}

export default async function giveawayEntryEditRoutes(fastify: FastifyInstance) {
  fastify.get('/giveaway-entry-edit/:token', async (request, reply) => {
    const token = normalize_token((request.params as { token?: unknown } | undefined)?.token)
    if (!token) return reply.code(400).send({ error: 'Invalid token' })

    const record = await prisma.giveawayEntryEditToken.findUnique({
      where: { token },
    })

    if (!record) return reply.code(404).send({ error: 'Not found' })

    const now = Date.now()
    if (record.expiresAt.getTime() <= now) {
      return reply.code(410).send({ error: 'Token expired' })
    }

    if (record.usedAt) {
      return reply.code(410).send({ error: 'Token already used' })
    }

    const giveaway = await prisma.giveaway.findUnique({
      where: { id: record.giveawayId },
    })

    if (!giveaway) return reply.code(404).send({ error: 'Giveaway not found' })

    if (giveaway.ended) return reply.code(400).send({ error: 'O sorteio já acabou.' })
    if (giveaway.cancelled) return reply.code(400).send({ error: 'Giveaway has been cancelled' })
    if (giveaway.suspended) return reply.code(400).send({ error: 'Giveaway is suspended' })
    if (giveaway.format !== 'list') return reply.code(400).send({ error: 'Giveaway is not a list giveaway' })

    const entry = await prisma.giveawayEntry.findUnique({
      where: {
        giveawayId_userId: {
          giveawayId: record.giveawayId,
          userId: record.userId,
        },
      },
    })

    if (!entry) return reply.code(404).send({ error: 'Entry not found' })

    const raw_items = Array.isArray(giveaway.availableItems) ? (giveaway.availableItems as string[]) : []
    const items = normalize_giveaway_items_list(raw_items)

    if (items.length === 0) {
      return reply.code(400).send({ error: 'Giveaway has no available items' })
    }

    return reply.send({
      success: true,
      tokenExpiresAt: record.expiresAt.toISOString(),
      giveaway: {
        id: giveaway.id,
        title: giveaway.title,
        description: giveaway.description,
        endsAt: giveaway.endsAt.toISOString(),
        format: giveaway.format,
        minChoices: giveaway.minChoices,
        maxChoices: giveaway.maxChoices,
      },
      entry: {
        userId: entry.userId,
        username: entry.username,
        choices: (entry.choices as string[] | null) ?? null,
      },
      availableItems: items,
    })
  })

  fastify.patch('/giveaway-entry-edit/:token', async (request, reply) => {
    const token = normalize_token((request.params as { token?: unknown } | undefined)?.token)
    if (!token) return reply.code(400).send({ error: 'Invalid token' })

    const choices = get_choices_from_body(request.body)
    if (!choices) return reply.code(400).send({ error: 'Invalid body' })

    const now = new Date()

    try {
      const result = await prisma.$transaction(async (tx) => {
        const record = await tx.giveawayEntryEditToken.findUnique({ where: { token } })
        if (!record) return { ok: false as const, code: 404 as const, error: 'Not found' as const }
        if (record.usedAt) return { ok: false as const, code: 410 as const, error: 'Token already used' as const }
        if (record.expiresAt.getTime() <= now.getTime()) return { ok: false as const, code: 410 as const, error: 'Token expired' as const }

        const giveaway = await tx.giveaway.findUnique({ where: { id: record.giveawayId } })
        if (!giveaway) return { ok: false as const, code: 404 as const, error: 'Giveaway not found' as const }

        if (giveaway.ended) return { ok: false as const, code: 400 as const, error: 'O sorteio já acabou.' as const }
        if (giveaway.cancelled) return { ok: false as const, code: 400 as const, error: 'Giveaway has been cancelled' as const }
        if (giveaway.suspended) return { ok: false as const, code: 400 as const, error: 'Giveaway is suspended' as const }
        if (giveaway.format !== 'list') return { ok: false as const, code: 400 as const, error: 'Giveaway is not a list giveaway' as const }

        const raw_items = Array.isArray(giveaway.availableItems) ? (giveaway.availableItems as string[]) : []
        const items = normalize_giveaway_items_list(raw_items)
        if (items.length === 0) {
          return { ok: false as const, code: 400 as const, error: 'Giveaway has no available items' as const }
        }

        const min = typeof giveaway.minChoices === 'number' ? giveaway.minChoices : null
        const max = typeof giveaway.maxChoices === 'number' ? giveaway.maxChoices : null

        if (min !== null && choices.length < min) {
          return { ok: false as const, code: 400 as const, error: `You must choose at least ${min} items` as const }
        }

        if (max !== null && choices.length > max) {
          return { ok: false as const, code: 400 as const, error: `You can choose at most ${max} items` as const }
        }

        const { invalid, resolved } = match_giveaway_choices({
          availableItems: items,
          choices,
        })

        const unique_resolved = dedupe_preserve_order(resolved)

        if (invalid.length > 0) {
          return { ok: false as const, code: 400 as const, error: 'Invalid choices' as const, invalid }
        }

        const consume = await tx.giveawayEntryEditToken.updateMany({
          where: {
            id: record.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        })

        if (consume.count !== 1) {
          return { ok: false as const, code: 410 as const, error: 'Token expired' as const }
        }

        const entry = await tx.giveawayEntry.update({
          where: {
            giveawayId_userId: {
              giveawayId: record.giveawayId,
              userId: record.userId,
            },
          },
          data: {
            choices: unique_resolved.length > 0 ? unique_resolved : Prisma.JsonNull,
          },
        })

        return {
          ok: true as const,
          entry: {
            userId: entry.userId,
            username: entry.username,
            choices: (entry.choices as string[] | null) ?? null,
          },
        }
      })

      if (!result.ok) {
        return reply.code(result.code).send('invalid' in result ? { error: result.error, invalid: result.invalid } : { error: result.error })
      }

      return reply.send({ success: true, entry: result.entry })
    } catch {
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
