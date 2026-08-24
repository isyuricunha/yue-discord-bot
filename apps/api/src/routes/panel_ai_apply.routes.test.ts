import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import type { FastifyBaseLogger } from 'fastify'

import { createPanelAiApplyRoutes } from './panel_ai_apply.routes'
import { PanelConversationQueue } from '../services/panel_conversation_queue'
import { PanelAiApplyProposalStore } from '../services/panel_ai_apply'

type test_user = {
  userId: string
  username: string
  discriminator: string
  avatar: string | null
  guilds: string[]
  guildsData: Array<{ id: string; name: string; icon: string | null }>
  isOwner: boolean
}

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>

function make_user(overrides: Partial<test_user> = {}): test_user {
  return {
    userId: 'user-1',
    username: 'Yue',
    discriminator: '0000',
    avatar: null,
    guilds: ['guild-1'],
    guildsData: [{ id: 'guild-1', name: 'Guild 1', icon: null }],
    isOwner: false,
    ...overrides,
  }
}

function make_db() {
  const state = {
    guildConfig: { guildId: 'guild-1', locale: 'pt-BR', timezone: 'America/Sao_Paulo' } as Record<string, unknown>,
    writes: 0,
    audits: [] as Array<Record<string, unknown>>,
  }

  const db: any = {
    guild: {
      findUnique: async () => ({ id: 'guild-1' }),
    },
    guildConfig: {
      findUnique: async () => state.guildConfig,
      upsert: async (args: any) => {
        state.writes += 1
        state.guildConfig = { ...state.guildConfig, ...(args.update ?? args.create ?? {}) }
        return state.guildConfig
      },
    },
    guildAntiRaidConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('anti-raid should not be written'),
    },
    guildXpConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('xp should not be written'),
    },
    guildAutoroleConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('autorole should not be written'),
    },
    auditLog: {
      create: async (args: any) => {
        state.audits.push(args.data)
        return args.data
      },
    },
  }
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db)
  return { db, state }
}

function create_app(options: {
  user?: test_user | null
  isGuildAdmin?: admin_check
} = {}) {
  const app = Fastify()
  const user = options.user === null ? null : (options.user ?? make_user())
  const { db, state } = make_db()

  app.decorate('config', { environment: 'test' } as any)
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!user) {
      await reply.code(401).send({ error: 'Unauthorized' })
      return
    }
    request.user = user
  }) as any

  app.register(createPanelAiApplyRoutes({
    db,
    store: new PanelAiApplyProposalStore(),
    queue: new PanelConversationQueue(),
    isGuildAdmin: options.isGuildAdmin ?? (async () => ({ isAdmin: true })),
    syncAutomod: async () => undefined,
  }))

  return { app, state }
}

test('confirmed apply routes require authentication', async (t) => {
  const { app } = create_app({ user: null })
  t.after(async () => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/apply-proposals',
    payload: { pageKey: 'settings', changes: [{ target: 'locale', value: 'en-US' }] },
  })
  assert.equal(response.statusCode, 401)
})

test('confirmed apply routes revalidate guild admin before preparing a mutation', async (t) => {
  const { app, state } = create_app({ isGuildAdmin: async () => ({ isAdmin: false }) })
  t.after(async () => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/apply-proposals',
    payload: { pageKey: 'settings', changes: [{ target: 'locale', value: 'en-US' }] },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(state.writes, 0)
  assert.equal(state.audits.length, 0)
})

test('prepare then confirm applies the server diff once and replays duplicate confirmation', async (t) => {
  const { app, state } = create_app()
  t.after(async () => app.close())

  const prepared = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/apply-proposals',
    payload: {
      pageKey: 'settings',
      changes: [
        { target: 'locale', value: 'en-US' },
        { target: 'timezone', value: 'Asia/Tokyo' },
      ],
    },
  })
  assert.equal(prepared.statusCode, 200)
  const preparedBody = prepared.json()
  assert.equal(preparedBody.success, true)
  assert.equal(preparedBody.noop, false)
  assert.equal(preparedBody.proposal.changes[0].before, 'pt-BR')
  assert.equal(preparedBody.proposal.changes[0].after, 'en-US')

  const proposalId = preparedBody.proposal.id as string
  const confirmed = await app.inject({
    method: 'POST',
    url: `/guilds/guild-1/panel-ai/apply-proposals/${proposalId}/confirm`,
    payload: {},
  })
  assert.equal(confirmed.statusCode, 200)
  assert.equal(confirmed.json().result.replayed, false)
  assert.equal(state.guildConfig.locale, 'en-US')
  assert.equal(state.guildConfig.timezone, 'Asia/Tokyo')
  assert.equal(state.writes, 1)
  assert.equal(state.audits.length, 1)

  const replay = await app.inject({
    method: 'POST',
    url: `/guilds/guild-1/panel-ai/apply-proposals/${proposalId}/confirm`,
    payload: {},
  })
  assert.equal(replay.statusCode, 200)
  assert.equal(replay.json().result.replayed, true)
  assert.equal(state.writes, 1)
  assert.equal(state.audits.length, 1)
})
