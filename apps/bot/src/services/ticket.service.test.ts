import assert from 'node:assert/strict'
import test from 'node:test'

import type { ButtonInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'

import { ticketService } from './ticket.service'

// Audit finding BOT-006: two concurrent open-ticket clicks could both pass the
// open-ticket check and create two Discord channels and two rows. The service
// now serializes handle_open per guild+user, so the second click observes the
// first click's open ticket.

type fake_channel = { id: string; send: () => Promise<void> }

function create_interaction(sequence: number, channels: Map<string, fake_channel>, rows: Array<Record<string, unknown>>) {
  const edit_replies: string[] = []

  const guild = {
    id: 'guild-1',
    roles: { everyone: { id: 'everyone' } },
    members: {
      fetchMe: async () => ({ permissions: { has: () => true } }),
    },
    channels: {
      create: async (args: { name: string }) => {
        const channel: fake_channel = { id: `chan-${sequence}-${channels.size + 1}`, send: async () => {} }
        channels.set(channel.id, channel)
        void args
        return channel
      },
      fetch: async (id: string) => channels.get(id) ?? null,
    },
  }

  const interaction = {
    guild,
    user: { id: 'user-1', username: 'yuri', tag: 'yuri#0001' },
    client: { user: { id: 'bot' } },
    deferReply: async () => {},
    editReply: async (payload: { content: string }) => {
      edit_replies.push(payload.content)
    },
  } as unknown as ButtonInteraction

  return { interaction, edit_replies }
}

test('concurrent open-ticket clicks create a single channel and row (audit finding BOT-006)', async (t) => {
  const channels = new Map<string, fake_channel>()
  const rows: Array<Record<string, unknown>> = []
  const originals: Array<() => void> = []
  t.after(() => originals.forEach((restore) => restore()))

  const stub = (target: any, method: string, implementation: (args: any) => unknown) => {
    const original = target[method]
    target[method] = implementation
    originals.push(() => {
      target[method] = original
    })
  }

  stub(prisma.ticketConfig, 'findUnique', async () => ({
    enabled: true,
    categoryId: null,
    logChannelId: null,
    supportRoleIds: [],
    panelChannelId: null,
    panelMessageId: null,
  }))

  stub(prisma.ticket, 'findFirst', async (args: any) => {
    return (
      rows.find(
        (row) =>
          row.guildId === args.where.guildId &&
          row.userId === args.where.userId &&
          row.status === 'open'
      ) ?? null
    )
  })

  stub(prisma.ticket, 'create', async (args: any) => {
    const row = { id: `ticket-${rows.length + 1}`, status: 'open', ...args.data }
    rows.push(row)
    return { id: row.id }
  })

  stub(prisma.ticket, 'update', async (args: any) => {
    const row = rows.find((candidate) => candidate.id === args.where.id)
    if (row) Object.assign(row, args.data)
    return row
  })

  const first = create_interaction(1, channels, rows)
  const second = create_interaction(2, channels, rows)

  await Promise.all([
    ticketService.handle_open(first.interaction),
    ticketService.handle_open(second.interaction),
  ])

  assert.equal(channels.size, 1, 'exactly one Discord channel must be created')
  assert.equal(rows.length, 1, 'exactly one open ticket row must exist')

  const all_replies = [...first.edit_replies, ...second.edit_replies]
  assert.ok(
    all_replies.some((content) => content.includes('já tem um ticket aberto')),
    'the losing click must be told an open ticket already exists'
  )
})
