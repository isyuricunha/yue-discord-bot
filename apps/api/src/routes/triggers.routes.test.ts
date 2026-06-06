import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import { createTriggersRoutes } from './triggers.routes'

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
  keywordTrigger: {
    findMany: (args: any) => Promise<any>
    findFirst: (args: any) => Promise<any>
    findUnique: (args: any) => Promise<any>
    create: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
    delete: (args: any) => Promise<any>
  }
}

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

function make_db(overrides: Partial<mock_db['keywordTrigger']> = {}): mock_db {
  return {
    keywordTrigger: {
      findMany: fail_if_called('keywordTrigger.findMany'),
      findFirst: fail_if_called('keywordTrigger.findFirst'),
      findUnique: fail_if_called('keywordTrigger.findUnique'),
      create: fail_if_called('keywordTrigger.create'),
      update: fail_if_called('keywordTrigger.update'),
      delete: fail_if_called('keywordTrigger.delete'),
      ...overrides,
    },
  }
}

function create_app(options: {
  user?: test_user
  db?: mock_db
  isGuildAdmin?: (guildId: string, userId: string) => Promise<{ isAdmin: boolean }>
} = {}) {
  const app = Fastify()
  const user = options.user ?? make_user()

  app.decorate('config', { environment: 'test' } as any)
  app.decorate('authenticate', async (request) => {
    ;(request as any).user = user
  })

  app.register(
    createTriggersRoutes({
      db: (options.db ?? make_db()) as any,
      isGuildAdmin: (guildId, userId) =>
        options.isGuildAdmin?.(guildId, userId) ?? Promise.resolve({ isAdmin: true }),
    })
  )

  return app
}

test('triggers return 400 for invalid create payloads', async (t) => {
  const app = create_app()
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guild-1/triggers',
    payload: {
      content: 'Hello!',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), { error: 'Invalid request' })
})

test('triggers reject invalid media urls before querying data', async (t) => {
  const app = create_app()
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guild-1/triggers',
    payload: {
      keyword: 'hello',
      mediaUrl: 'http://example.com/image.png',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), {
    error:
      'URL inválida ou do domínio não permitido. Aceito apenas URLs https de domínios confiáveis ou com extensão de mídia conhecida.',
  })
})

test('triggers return 400 for invalid update payloads', async (t) => {
  const app = create_app()
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/guild-1/triggers/trigger-1',
    payload: {
      mediaUrl: 'not-a-url',
    },
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.json(), { error: 'Invalid request' })
})

test('triggers update without sending unknown prisma fields', async (t) => {
  let update_payload: any
  const app = create_app({
    db: make_db({
      findUnique: async () => ({
        id: 'trigger-1',
        guildId: 'guild-1',
        keyword: 'old',
        keywords: ['old'],
        mediaUrl: null,
        content: 'Old',
      }),
      findFirst: async () => null,
      update: async (args) => {
        update_payload = args
        return { id: 'trigger-1', guildId: 'guild-1', ...args.data }
      },
    }),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/guild-1/triggers/trigger-1',
    payload: {
      keyword: ' New ',
      content: 'Updated',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(update_payload.data.keyword, 'new')
  assert.deepEqual(update_payload.data.keywords, ['new'])
  assert.equal(update_payload.data.content, 'Updated')
  assert.equal('updatedAt' in update_payload.data, false)
})
