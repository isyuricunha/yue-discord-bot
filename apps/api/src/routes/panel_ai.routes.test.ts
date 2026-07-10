import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import type { FastifyBaseLogger } from 'fastify'

import { createPanelAiRoutes } from './panel_ai.routes'
import { ConversationStore, DEFAULT_MAX_HISTORY_MESSAGES } from '../services/conversation_store'

type test_user = {
  userId: string
  username: string
  discriminator: string
  avatar: string | null
  guilds: string[]
  guildsData: Array<{ id: string; name: string; icon: string | null }>
  isOwner: boolean
}

type mock_db = {
  botSettings: {
    findUnique: (args: any) => Promise<any>
  }
  guild: {
    findUnique: (args: any) => Promise<any>
  }
  guildAntiRaidConfig: {
    findUnique: (args: any) => Promise<any>
  }
}

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>

type complete_panel_ai_fn = (input: any) => Promise<string>

function fail_if_called(name: string) {
  return async () => {
    assert.fail(`${name} should not be called`)
  }
}

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

function make_db(overrides: {
  botSettings?: Partial<mock_db['botSettings']>
  guild?: Partial<mock_db['guild']>
  guildAntiRaidConfig?: Partial<mock_db['guildAntiRaidConfig']>
} = {}): mock_db {
  return {
    botSettings: {
      findUnique: fail_if_called('botSettings.findUnique'),
      ...overrides.botSettings,
    },
    guild: {
      findUnique: fail_if_called('guild.findUnique'),
      ...overrides.guild,
    },
    guildAntiRaidConfig: {
      findUnique: fail_if_called('guildAntiRaidConfig.findUnique'),
      ...overrides.guildAntiRaidConfig,
    },
  }
}

function create_app(options: {
  user?: test_user | null
  db?: mock_db
  store?: ConversationStore
  isGuildAdmin?: admin_check
  completePanelAi?: complete_panel_ai_fn
} = {}) {
  const app = Fastify()
  const store = options.store ?? new ConversationStore()
  // null means "unauthenticated"; undefined means "use a default user".
  const user: test_user | null = options.user === null ? null : (options.user ?? make_user())

  app.decorate('config', { environment: 'test' } as any)
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!user) {
      await reply.code(401).send({ error: 'Unauthorized' })
      return
    }

    request.user = user
  }) as any

  app.register(
    createPanelAiRoutes({
      db: (options.db ?? make_db()) as any,
      store,
      isGuildAdmin: options.isGuildAdmin ??
        (async () => ({ isAdmin: true })) as admin_check,
      completePanelAi: options.completePanelAi ??
        (async () => 'mocked reply') as complete_panel_ai_fn,
    }),
  )

  return { app, store }
}

test('panel-ai chat requires authentication', async (t) => {
  const { app } = create_app({ user: null, db: make_db() })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/chat',
    payload: { message: 'hello' },
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.json(), { error: 'Unauthorized' })
})

test('panel-ai chat rejects users without guild access', async (t) => {
  const { app } = create_app({
    user: make_user({ guilds: [] }),
    db: make_db(),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/chat',
    payload: { message: 'hello' },
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.json(), { error: 'Forbidden' })
})

test('panel-ai chat rejects non-admin users with 403', async (t) => {
  const { app } = create_app({
    user: make_user({ isOwner: false }),
    db: make_db(),
    isGuildAdmin: async () => ({ isAdmin: false }),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/chat',
    payload: { message: 'hello' },
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.json(), { error: 'Forbidden' })
})

test('GET history returns only natural user/assistant messages', async (t) => {
  const store = new ConversationStore()
  store.set('guild-1:user-1', 1, [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
  ])

  const { app } = create_app({
    db: make_db({
      botSettings: { findUnique: async () => ({ panelAiConversationVersion: 1 }) },
    }),
    store,
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guilds/guild-1/panel-ai/history',
  })

  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.success, true)
  assert.equal(body.messages.length, 2)
  assert.deepEqual(body.messages[0], { role: 'user', content: 'hi' })
  assert.deepEqual(body.messages[1], { role: 'assistant', content: 'hello' })
})

test('GET history of expired entry returns empty', async (t) => {
  const store = new ConversationStore({ ttlMs: -1000 })
  store.set('guild-1:user-1', 1, [
    { role: 'user', content: 'old' },
    { role: 'assistant', content: 'reply' },
  ])

  const { app } = create_app({
    db: make_db({
      botSettings: { findUnique: async () => ({ panelAiConversationVersion: 1 }) },
    }),
    store,
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guilds/guild-1/panel-ai/history',
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().messages.length, 0)
})

test('history is isolated by user within the same guild', async (t) => {
  const store = new ConversationStore()
  store.set('guild-1:user-1', 1, [{ role: 'user', content: 'user 1 message' }])
  store.set('guild-1:user-2', 1, [{ role: 'user', content: 'user 2 message' }])

  const { app } = create_app({
    user: make_user({ userId: 'user-1' }),
    db: make_db({
      botSettings: { findUnique: async () => ({ panelAiConversationVersion: 1 }) },
    }),
    store,
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guilds/guild-1/panel-ai/history',
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().messages[0].content, 'user 1 message')
})

test('history is isolated by guild for the same user', async (t) => {
  const store = new ConversationStore()
  store.set('guild-1:user-1', 1, [{ role: 'user', content: 'guild 1' }])
  store.set('guild-2:user-1', 1, [{ role: 'user', content: 'guild 2' }])

  const { app } = create_app({
    user: make_user({ userId: 'user-1', guilds: ['guild-1'] }),
    db: make_db({
      botSettings: { findUnique: async () => ({ panelAiConversationVersion: 1 }) },
    }),
    store,
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guilds/guild-1/panel-ai/history',
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().messages[0].content, 'guild 1')
})

test('DELETE history is idempotent', async (t) => {
  const { app } = create_app({
    db: make_db(),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/guilds/guild-1/panel-ai/history',
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { success: true })
})

test('response payload does not contain persona, context, or instructions', async (t) => {
  const { app } = create_app({
    db: make_db({
      botSettings: {
        findUnique: async () => ({
          panelAiProvider: 'custom',
          customProviderModel: 'test-model',
          panelAiConversationVersion: 1,
        }),
      },
      guild: {
        findUnique: async () => ({
          id: 'guild-1',
          name: 'Test Guild',
          config: { welcomeChannelId: null, wordFilterEnabled: false, aiModerationEnabled: false },
        }),
      },
      guildAntiRaidConfig: {
        findUnique: async () => null,
      },
    }),
    completePanelAi: async () => 'sure thing',
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guilds/guild-1/panel-ai/chat',
    payload: { message: 'hello' },
  })

  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.success, true)
  assert.equal(body.response, 'sure thing')
  assert.ok(!('persona' in body), 'persona must not be in response')
  assert.ok(!('context' in body), 'context must not be in response')
  assert.ok(!('instructions' in body), 'instructions must not be in response')
  assert.deepEqual(body.actions, [])
})

test('message limit is enforced by the real store implementation', async (t) => {
  let call_count = 0
  const store = new ConversationStore({ maxHistoryMessages: DEFAULT_MAX_HISTORY_MESSAGES })
  const { app } = create_app({
    db: make_db({
      botSettings: {
        findUnique: async () => ({ panelAiProvider: 'mistral', panelAiConversationVersion: 1 }),
      },
      guild: {
        findUnique: async () => ({
          id: 'guild-1',
          name: 'Test Guild',
          config: { welcomeChannelId: null, wordFilterEnabled: false, aiModerationEnabled: false },
        }),
      },
      guildAntiRaidConfig: { findUnique: async () => null },
    }),
    store,
    completePanelAi: async () => {
      call_count += 1
      return `reply ${call_count}`
    },
  })
  t.after(async () => {
    await app.close()
  })

  // Send more than MAX_HISTORY_MESSAGES rounds (each round adds user + assistant).
  const rounds = DEFAULT_MAX_HISTORY_MESSAGES / 2 + 2
  for (let i = 0; i < rounds; i++) {
    const response = await app.inject({
      method: 'POST',
      url: '/guilds/guild-1/panel-ai/chat',
      payload: { message: `msg ${i}` },
    })
    assert.equal(response.statusCode, 200, `round ${i} should succeed`)
  }

  // After many rounds, the store should have at most MAX_HISTORY_MESSAGES entries.
  const history = store.get('guild-1:user-1', 1)
  assert.ok(
    history.length <= DEFAULT_MAX_HISTORY_MESSAGES,
    `history (${history.length}) must not exceed max (${DEFAULT_MAX_HISTORY_MESSAGES})`,
  )
})
