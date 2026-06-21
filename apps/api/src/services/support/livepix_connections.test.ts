import test from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyBaseLogger } from 'fastify'
import { LivePixConnectionMode, LivePixConnectionStatus } from '@yuebot/database'

import { create_livepix_connection_service } from './livepix_connections'

const RAW_KEY = 'a'.repeat(32)
const NOW = new Date('2026-06-21T12:00:00.000Z')

function make_config() {
  return {
    livePix: {
      enabled: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      oauthRedirectUri: 'https://yuebot.yuricunha.com/api/livepix/oauth/callback',
      webhookUrl: 'https://yuebot.yuricunha.com/api/livepix/webhook',
      tokenEncryptionKey: RAW_KEY,
      ownerGuildIds: ['owner-guild'],
    },
    admin: {
      ownerUserIds: [],
    },
  }
}

function make_account() {
  return {
    id: 'provider-account-1',
    email: 'account@example.com',
    username: 'provider-user',
    displayName: 'Provider User',
    avatar: null,
  }
}

function make_connection(data: Record<string, any>) {
  return {
    id: 'connection-1',
    guildId: data.guildId,
    mode: data.mode,
    providerAccountId: data.providerAccountId,
    providerAccountUsername: data.providerAccountUsername,
    providerAccountDisplayName: data.providerAccountDisplayName,
    providerAccountAvatar: data.providerAccountAvatar,
    encryptedAccessToken: data.encryptedAccessToken,
    encryptedRefreshToken: data.encryptedRefreshToken,
    tokenExpiresAt: data.tokenExpiresAt,
    grantedScopes: data.grantedScopes,
    status: data.status,
    connectedByUserId: data.connectedByUserId,
    providerWebhookId: data.providerWebhookId,
    connectedAt: NOW,
    disconnectedAt: null,
    lastErrorCode: null,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function make_state_row(overrides: Record<string, any> = {}) {
  return {
    id: 'oauth-state-1',
    stateHash: 'state-hash',
    guildId: 'oauth-guild',
    userId: 'admin-user',
    usedAt: null,
    expiresAt: new Date(NOW.getTime() + 60_000),
    createdAt: NOW,
    ...overrides,
  }
}

function fail_if_called(name: string) {
  return async () => {
    assert.fail(`${name} should not be called`)
  }
}

function make_db(options: {
  stateRow?: Record<string, any> | null
  updateManyCount?: number
} = {}) {
  const calls = {
    connectionUpserts: [] as any[],
    supportConfigUpserts: [] as any[],
    stateUpdates: [] as any[],
  }

  const db = {
    livePixConnection: {
      upsert: async (args: any) => {
        calls.connectionUpserts.push(args)
        return make_connection(args.create)
      },
      findUnique: fail_if_called('livePixConnection.findUnique'),
      update: fail_if_called('livePixConnection.update'),
    },
    guildSupportConfig: {
      upsert: async (args: any) => {
        calls.supportConfigUpserts.push(args)
        return { id: 'support-config-1', ...args.create, ...args.update }
      },
      updateMany: fail_if_called('guildSupportConfig.updateMany'),
    },
    supportOAuthState: {
      create: fail_if_called('supportOAuthState.create'),
      findUnique: async () => options.stateRow ?? make_state_row(),
      updateMany: async (args: any) => {
        calls.stateUpdates.push(args)
        return { count: options.updateManyCount ?? 1 }
      },
    },
  }

  return { db, calls }
}

function make_livepix_client(options: {
  tokenFailure?: Error
  accountFailure?: Error
} = {}) {
  const calls = {
    exchangeAuthorizationCodes: [] as any[],
    getAccounts: [] as string[],
    webhookRequests: [] as string[],
  }

  const client = {
    exchangeAuthorizationCode: async (input: any) => {
      calls.exchangeAuthorizationCodes.push(input)
      if (options.tokenFailure) throw options.tokenFailure
      return {
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        expiresIn: 3600,
        scope: 'account:read payments:read payments:write webhooks',
        tokenType: 'Bearer',
      }
    },
    getAccount: async (access_token: string) => {
      calls.getAccounts.push(access_token)
      if (options.accountFailure) throw options.accountFailure
      return make_account()
    },
    listWebhooks: async () => {
      calls.webhookRequests.push('GET /v2/webhooks')
      throw new Error('GET /v2/webhooks should not be called')
    },
    createWebhook: async () => {
      calls.webhookRequests.push('POST /v2/webhooks')
      throw new Error('POST /v2/webhooks should not be called')
    },
    ensureWebhook: async () => {
      calls.webhookRequests.push('ensureWebhook')
      throw new Error('ensureWebhook should not be called')
    },
  }

  return { client, calls }
}

function make_service(options: {
  db?: ReturnType<typeof make_db>['db']
  livepixClient?: ReturnType<typeof make_livepix_client>['client']
  getOwnerAccessToken?: () => Promise<string>
  isGuildAdmin?: () => Promise<{ isAdmin: boolean }>
} = {}) {
  return create_livepix_connection_service({
    db: (options.db ?? make_db().db) as any,
    config: make_config(),
    livepixClient: (options.livepixClient ?? make_livepix_client().client) as any,
    getOwnerAccessToken: options.getOwnerAccessToken ?? (async () => 'owner-access-token'),
    isGuildAdmin: (options.isGuildAdmin ?? (async () => ({ isAdmin: true }))) as any,
    now: () => NOW,
  })
}

const test_log = {} as FastifyBaseLogger

test('owner LivePix connection succeeds without calling the per-user webhook API', async () => {
  const { db, calls: db_calls } = make_db()
  const { client, calls: client_calls } = make_livepix_client()
  const service = make_service({ db, livepixClient: client })

  const connection = await service.connect_livepix_owner_guild({
    guildId: 'owner-guild',
    userId: 'admin-user',
  })

  assert.equal(connection?.status, LivePixConnectionStatus.CONNECTED)
  assert.equal(connection?.mode, LivePixConnectionMode.OWNER)
  assert.equal(connection?.providerWebhookId, null)
  assert.deepEqual(client_calls.getAccounts, ['owner-access-token'])
  assert.deepEqual(client_calls.webhookRequests, [])
  assert.equal(db_calls.connectionUpserts.length, 1)
  assert.equal(db_calls.connectionUpserts[0]?.create.providerWebhookId, null)
  assert.equal(db_calls.connectionUpserts[0]?.create.status, LivePixConnectionStatus.CONNECTED)
})

test('OAuth LivePix connection succeeds without calling the per-user webhook API', async () => {
  const { db, calls: db_calls } = make_db()
  const { client, calls: client_calls } = make_livepix_client()
  const service = make_service({ db, livepixClient: client })

  const result = await service.handle_livepix_oauth_callback({
    code: 'oauth-code',
    state: 'state-value',
    log: test_log,
  })

  assert.equal(result.guildId, 'oauth-guild')
  assert.equal(result.connection?.status, LivePixConnectionStatus.CONNECTED)
  assert.equal(result.connection?.mode, LivePixConnectionMode.OAUTH)
  assert.equal(result.connection?.providerWebhookId, null)
  assert.equal(result.refreshTokenReturned, true)
  assert.deepEqual(client_calls.getAccounts, ['oauth-access-token'])
  assert.deepEqual(client_calls.webhookRequests, [])
  assert.equal(db_calls.connectionUpserts.length, 1)
  assert.equal(db_calls.connectionUpserts[0]?.create.providerWebhookId, null)
  assert.equal(db_calls.connectionUpserts[0]?.create.status, LivePixConnectionStatus.CONNECTED)
})

test('OAuth token failure prevents LivePix connection storage', async () => {
  const { db, calls: db_calls } = make_db()
  const { client, calls: client_calls } = make_livepix_client({
    tokenFailure: new Error('token failed'),
  })
  const service = make_service({ db, livepixClient: client })

  await assert.rejects(
    () =>
      service.handle_livepix_oauth_callback({
        code: 'oauth-code',
        state: 'state-value',
        log: test_log,
      }),
    /token failed/
  )

  assert.equal(db_calls.connectionUpserts.length, 0)
  assert.deepEqual(client_calls.getAccounts, [])
  assert.deepEqual(client_calls.webhookRequests, [])
})

test('account lookup failure prevents LivePix connection storage', async () => {
  const { db, calls: db_calls } = make_db()
  const { client, calls: client_calls } = make_livepix_client({
    accountFailure: new Error('account failed'),
  })
  const service = make_service({ db, livepixClient: client })

  await assert.rejects(
    () =>
      service.handle_livepix_oauth_callback({
        code: 'oauth-code',
        state: 'state-value',
        log: test_log,
      }),
    /account failed/
  )

  assert.equal(db_calls.connectionUpserts.length, 0)
  assert.deepEqual(client_calls.webhookRequests, [])
})

test('owner token failure prevents LivePix connection storage', async () => {
  const { db, calls: db_calls } = make_db()
  const { client, calls: client_calls } = make_livepix_client()
  const service = make_service({
    db,
    livepixClient: client,
    getOwnerAccessToken: async () => {
      throw new Error('owner token failed')
    },
  })

  await assert.rejects(
    () =>
      service.connect_livepix_owner_guild({
        guildId: 'owner-guild',
        userId: 'admin-user',
      }),
    /owner token failed/
  )

  assert.equal(db_calls.connectionUpserts.length, 0)
  assert.deepEqual(client_calls.getAccounts, [])
  assert.deepEqual(client_calls.webhookRequests, [])
})
