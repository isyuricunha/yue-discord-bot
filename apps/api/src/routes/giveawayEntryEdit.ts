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

    const giveaway = await prisma.giveaway.findUnique({
      where: { id: record.giveawayId },
    })

    if (!giveaway) return reply.code(404).send({ error: 'Giveaway not found' })

    if (giveaway.ended) return reply.code(400).send({ error: 'Giveaway has already ended' })
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

    const record = await prisma.giveawayEntryEditToken.findUnique({
      where: { token },
    })

    if (!record) return reply.code(404).send({ error: 'Not found' })

    const now = Date.now()
    if (record.expiresAt.getTime() <= now) {
      return reply.code(410).send({ error: 'Token expired' })
    }

    const giveaway = await prisma.giveaway.findUnique({
      where: { id: record.giveawayId },
    })

    if (!giveaway) return reply.code(404).send({ error: 'Giveaway not found' })

    if (giveaway.ended) return reply.code(400).send({ error: 'Giveaway has already ended' })
    if (giveaway.cancelled) return reply.code(400).send({ error: 'Giveaway has been cancelled' })
    if (giveaway.suspended) return reply.code(400).send({ error: 'Giveaway is suspended' })
    if (giveaway.format !== 'list') return reply.code(400).send({ error: 'Giveaway is not a list giveaway' })

    const raw_items = Array.isArray(giveaway.availableItems) ? (giveaway.availableItems as string[]) : []
    const items = normalize_giveaway_items_list(raw_items)

    if (items.length === 0) {
      return reply.code(400).send({ error: 'Giveaway has no available items' })
    }

    const min = typeof giveaway.minChoices === 'number' ? giveaway.minChoices : null
    const max = typeof giveaway.maxChoices === 'number' ? giveaway.maxChoices : null

    if (min !== null && choices.length < min) {
      return reply.code(400).send({ error: `You must choose at least ${min} items` })
    }

    if (max !== null && choices.length > max) {
      return reply.code(400).send({ error: `You can choose at most ${max} items` })
    }

    const { invalid, resolved } = match_giveaway_choices({
      availableItems: items,
      choices,
    })

    if (invalid.length > 0) {
      return reply.code(400).send({
        error: 'Invalid choices',
        invalid,
      })
    }

    const entry = await prisma.giveawayEntry.update({
      where: {
        giveawayId_userId: {
          giveawayId: record.giveawayId,
          userId: record.userId,
        },
      },
      data: {
        choices: resolved.length > 0 ? resolved : Prisma.JsonNull,
      },
    })

    return reply.send({
      success: true,
      entry: {
        userId: entry.userId,
        username: entry.username,
        choices: (entry.choices as string[] | null) ?? null,
      },
    })
  })
}
