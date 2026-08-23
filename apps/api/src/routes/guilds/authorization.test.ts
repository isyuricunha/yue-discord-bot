import test from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'
import { createGuildRouteAuthorization } from './authorization'

type reply_state = {
  status: number | null
  body: unknown
}

function create_reply() {
  const state: reply_state = { status: null, body: undefined }
  const reply = {
    code(status: number) {
      state.status = status
      return reply
    },
    send(body: unknown) {
      state.body = body
      return reply
    },
  } as unknown as FastifyReply

  return { reply, state }
}

function create_request(user: Record<string, unknown>, guild_id = 'guild-1') {
  return {
    params: { guildId: guild_id },
    user,
    log: {
      warn() {},
    } as unknown as FastifyBaseLogger,
  } as unknown as FastifyRequest
}

test('requireGuildAccess denies a guild outside route claims', async () => {
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => true,
  })
  const request = create_request({
    userId: 'user-1',
    guilds: ['guild-2'],
    isOwner: false,
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAccess(request, reply)

  assert.equal(state.status, 403)
  assert.deepEqual(state.body, { error: 'Forbidden' })
})

test('requireGuildAccess returns not found for an authorized guild missing from the database', async () => {
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => false,
  })
  const request = create_request({
    userId: 'user-1',
    guilds: ['guild-1'],
    isOwner: false,
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAccess(request, reply)

  assert.equal(state.status, 404)
  assert.deepEqual(state.body, { error: 'Guild not found' })
})

test('requireGuildAdmin performs an explicit admin lookup outside the global live guard', async () => {
  let admin_calls = 0
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => true,
    isGuildAdmin: async () => {
      admin_calls += 1
      return { isAdmin: false }
    },
  })
  const request = create_request({
    userId: 'user-1',
    guilds: ['guild-1'],
    isOwner: false,
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAdmin(request, reply)

  assert.equal(admin_calls, 1)
  assert.equal(state.status, 403)
  assert.deepEqual(state.body, { error: 'Forbidden' })
})

test('requireGuildAdmin reuses the successful global live authorization result', async () => {
  let admin_calls = 0
  let existence_calls = 0
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => {
      existence_calls += 1
      return true
    },
    isGuildAdmin: async () => {
      admin_calls += 1
      return { isAdmin: true }
    },
  })
  const request = create_request({
    userId: 'user-1',
    guilds: [],
    isOwner: false,
    liveGuildAuthorizationChecked: true,
    verifiedGuildIds: ['guild-1'],
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAdmin(request, reply)

  assert.equal(admin_calls, 0)
  assert.equal(existence_calls, 1)
  assert.equal(state.status, null)
  assert.equal(state.body, undefined)
})

test('requireGuildAdmin fails closed when an isolated live admin lookup is unavailable', async () => {
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => true,
    isGuildAdmin: async () => {
      throw new Error('bot internal API unavailable')
    },
  })
  const request = create_request({
    userId: 'user-1',
    guilds: ['guild-1'],
    isOwner: false,
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAdmin(request, reply)

  assert.equal(state.status, 503)
  assert.deepEqual(state.body, { error: 'Authorization unavailable' })
})

test('owner bypasses the admin lookup but still requires an installed guild', async () => {
  let admin_calls = 0
  const authorization = createGuildRouteAuthorization({
    guildExists: async () => false,
    isGuildAdmin: async () => {
      admin_calls += 1
      return { isAdmin: false }
    },
  })
  const request = create_request({
    userId: 'owner-1',
    guilds: [],
    isOwner: true,
  })
  const { reply, state } = create_reply()

  await authorization.requireGuildAdmin(request, reply)

  assert.equal(admin_calls, 0)
  assert.equal(state.status, 404)
  assert.deepEqual(state.body, { error: 'Guild not found' })
})
