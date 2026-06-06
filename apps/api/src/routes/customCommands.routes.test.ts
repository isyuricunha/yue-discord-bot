import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import { createCustomCommandsRoutes } from './customCommands.routes'

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
  guild: {
    findUnique: (args: any) => Promise<any>
  }
  customCommand: {
    findMany: (args: any) => Promise<any>
    findUnique: (args: any) => Promise<any>
    findFirst: (args: any) => Promise<any>
    create: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
    delete: (args: any) => Promise<any>
  }
}

type mock_db_overrides = {
  guild?: Partial<mock_db['guild']>
  customCommand?: Partial<mock_db['customCommand']>
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

function make_db(overrides: mock_db_overrides = {}): mock_db {
  return {
    guild: {
      findUnique: fail_if_called('guild.findUnique'),
      ...overrides.guild,
    },
    customCommand: {
      findMany: fail_if_called('customCommand.findMany'),
      findUnique: fail_if_called('customCommand.findUnique'),
      findFirst: fail_if_called('customCommand.findFirst'),
      create: fail_if_called('customCommand.create'),
      update: fail_if_called('customCommand.update'),
      delete: fail_if_called('customCommand.delete'),
      ...overrides.customCommand,
    },
  }
}

function create_app(options: {
  user: test_user | null
  db: mock_db
  isGuildAdmin?: (guildId: string, userId: string) => Promise<{ isAdmin: boolean }>
}) {
  const app = Fastify()

  app.decorate('config', { environment: 'test' } as any)
  app.decorate('authenticate', async (request, reply) => {
    if (!options.user) {
      await reply.code(401).send({ error: 'Unauthorized' })
      return
    }

    ;(request as any).user = options.user
  })

  app.register(
    createCustomCommandsRoutes({
      db: options.db as any,
      isGuildAdmin: (guildId, userId) =>
        options.isGuildAdmin?.(guildId, userId) ?? Promise.resolve({ isAdmin: false }),
    })
  )

  return app
}

test('custom commands require authentication', async (t) => {
  const app = create_app({
    user: null,
    db: make_db(),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guild-1/custom-commands',
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.json(), { error: 'Unauthorized' })
})

test('custom commands reject users without guild access before querying data', async (t) => {
  const app = create_app({
    user: make_user({ guilds: [] }),
    db: make_db(),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/guild-1/custom-commands',
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.json(), { error: 'Forbidden' })
})

test('custom commands allow an owner to create commands for installed guilds', async (t) => {
  let created_payload: any
  const app = create_app({
    user: make_user({ isOwner: true, guilds: [] }),
    db: make_db({
      guild: {
        findUnique: async () => ({ id: 'guild-1' }),
      },
      customCommand: {
        findUnique: async () => null,
        create: async (args) => {
          created_payload = args.data
          return {
            id: 'command-1',
            ...args.data,
          }
        },
      },
    }),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/guild-1/custom-commands',
    payload: {
      name: '  hello  ',
      description: '  Say hello  ',
      response: '  Hi!  ',
    },
  })

  assert.equal(response.statusCode, 201)
  assert.deepEqual(created_payload, {
    guildId: 'guild-1',
    name: 'hello',
    description: 'Say hello',
    response: 'Hi!',
  })
  assert.equal(response.json().id, 'command-1')
})

test('custom commands require fresh admin permissions for non-owner writes', async (t) => {
  let admin_check_input: Array<string> | null = null
  let updated_payload: any
  const app = create_app({
    user: make_user({ userId: 'admin-1', guilds: ['guild-1'] }),
    isGuildAdmin: async (guildId, userId) => {
      admin_check_input = [guildId, userId]
      return { isAdmin: true }
    },
    db: make_db({
      guild: {
        findUnique: async () => ({ id: 'guild-1' }),
      },
      customCommand: {
        findUnique: async () => ({ guildId: 'guild-1' }),
        findFirst: async () => null,
        update: async (args) => {
          updated_payload = args
          return { id: 'command-1', guildId: 'guild-1', ...args.data }
        },
      },
    }),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/guild-1/custom-commands/command-1',
    payload: {
      name: 'hello',
      description: 'Say hello',
      response: 'Hi!',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(admin_check_input, ['guild-1', 'admin-1'])
  assert.deepEqual(updated_payload, {
    where: { id: 'command-1' },
    data: {
      name: 'hello',
      description: 'Say hello',
      response: 'Hi!',
    },
  })
})

test('custom commands do not delete commands from another guild', async (t) => {
  const app = create_app({
    user: make_user({ isOwner: true }),
    db: make_db({
      guild: {
        findUnique: async () => ({ id: 'guild-1' }),
      },
      customCommand: {
        findUnique: async () => ({ guildId: 'guild-2' }),
      },
    }),
  })
  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'DELETE',
    url: '/guild-1/custom-commands/command-1',
  })

  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.json(), { error: 'Comando não encontrado.' })
})
