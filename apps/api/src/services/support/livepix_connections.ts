import { createHash, randomBytes } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import {
  build_livepix_authorization_url,
  encrypt_livepix_secret,
  type LivePixAccount,
  LivePixClient,
  LivePixClientCredentialsTokenCache,
  type LivePixTokenResponse,
  LIVEPIX_REQUIRED_SCOPES,
  parse_livepix_encryption_key,
} from '@yuebot/livepix'
import { LivePixConnectionMode, LivePixConnectionStatus, prisma } from '@yuebot/database'
import type { LivePixConnection } from '@yuebot/database'
import { CONFIG } from '../../config'
import { is_guild_admin } from '../../internal/bot_internal_api'

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export class SupportApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'SupportApiError'
  }
}

export type safe_livepix_connection = {
  id: string
  mode: LivePixConnectionMode
  status: LivePixConnectionStatus
  providerAccountId: string
  providerAccountUsername: string | null
  providerAccountDisplayName: string | null
  providerAccountAvatar: string | null
  providerWebhookId: string | null
  connectedByUserId: string
  connectedAt: string
  tokenExpiresAt: string | null
  reconnectRequired: boolean
}

const livepix_client = new LivePixClient()
let owner_token_cache: LivePixClientCredentialsTokenCache | null = null

type livepix_connection_db = Pick<typeof prisma, 'guildSupportConfig' | 'livePixConnection' | 'supportOAuthState'>

type livepix_connection_config = {
  livePix: typeof CONFIG.livePix
  admin: Pick<typeof CONFIG.admin, 'ownerUserIds'>
}

type livepix_connection_client = {
  exchangeAuthorizationCode(input: {
    clientId: string
    clientSecret: string
    code: string
    redirectUri: string
  }): Promise<LivePixTokenResponse>
  getAccount(accessToken: string): Promise<LivePixAccount>
}

type livepix_connection_dependencies = {
  db: livepix_connection_db
  config: livepix_connection_config
  livepixClient: livepix_connection_client
  getOwnerAccessToken: () => Promise<string>
  isGuildAdmin: typeof is_guild_admin
  now: () => Date
}

function hash_state(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

function assert_livepix_enabled(config: livepix_connection_config) {
  if (!config.livePix.enabled) {
    throw new SupportApiError(503, 'LivePix is not configured')
  }

  parse_livepix_encryption_key(config.livePix.tokenEncryptionKey)
}

function get_owner_token_cache() {
  if (!owner_token_cache) {
    owner_token_cache = new LivePixClientCredentialsTokenCache(livepix_client, {
      clientId: CONFIG.livePix.clientId,
      clientSecret: CONFIG.livePix.clientSecret,
      scopes: LIVEPIX_REQUIRED_SCOPES,
    })
  }

  return owner_token_cache
}

function default_livepix_connection_dependencies(): livepix_connection_dependencies {
  return {
    db: prisma,
    config: CONFIG,
    livepixClient: livepix_client,
    getOwnerAccessToken: () => get_owner_token_cache().getAccessToken(),
    isGuildAdmin: is_guild_admin,
    now: () => new Date(),
  }
}

export function serialize_livepix_connection(connection: LivePixConnection | null): safe_livepix_connection | null {
  if (!connection) return null

  const token_expired =
    connection.mode === LivePixConnectionMode.OAUTH &&
    connection.tokenExpiresAt !== null &&
    connection.tokenExpiresAt.getTime() <= Date.now()

  return {
    id: connection.id,
    mode: connection.mode,
    status: token_expired ? LivePixConnectionStatus.REAUTH_REQUIRED : connection.status,
    providerAccountId: connection.providerAccountId,
    providerAccountUsername: connection.providerAccountUsername,
    providerAccountDisplayName: connection.providerAccountDisplayName,
    providerAccountAvatar: connection.providerAccountAvatar,
    providerWebhookId: connection.providerWebhookId,
    connectedByUserId: connection.connectedByUserId,
    connectedAt: connection.connectedAt.toISOString(),
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    reconnectRequired: connection.status === LivePixConnectionStatus.REAUTH_REQUIRED || token_expired,
  }
}

async function store_connected_account(dependencies: livepix_connection_dependencies, input: {
  guildId: string
  connectedByUserId: string
  mode: LivePixConnectionMode
  accessTokenEncrypted: string | null
  refreshTokenEncrypted: string | null
  tokenExpiresAt: Date | null
  scopes: readonly string[]
  providerWebhookId: string | null
  account: {
    id: string
    username: string
    displayName: string
    avatar: string | null
  }
}) {
  const connection = await dependencies.db.livePixConnection.upsert({
    where: { guildId: input.guildId },
    update: {
      mode: input.mode,
      providerAccountId: input.account.id,
      providerAccountUsername: input.account.username,
      providerAccountDisplayName: input.account.displayName,
      providerAccountAvatar: input.account.avatar,
      encryptedAccessToken: input.accessTokenEncrypted,
      encryptedRefreshToken: input.refreshTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      grantedScopes: [...input.scopes],
      status: LivePixConnectionStatus.CONNECTED,
      connectedByUserId: input.connectedByUserId,
      providerWebhookId: input.providerWebhookId,
      disconnectedAt: null,
      lastErrorCode: null,
    },
    create: {
      guildId: input.guildId,
      mode: input.mode,
      providerAccountId: input.account.id,
      providerAccountUsername: input.account.username,
      providerAccountDisplayName: input.account.displayName,
      providerAccountAvatar: input.account.avatar,
      encryptedAccessToken: input.accessTokenEncrypted,
      encryptedRefreshToken: input.refreshTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      grantedScopes: [...input.scopes],
      status: LivePixConnectionStatus.CONNECTED,
      connectedByUserId: input.connectedByUserId,
      providerWebhookId: input.providerWebhookId,
    },
  })

  await dependencies.db.guildSupportConfig.upsert({
    where: { guildId: input.guildId },
    update: { livePixConnectionId: connection.id },
    create: { guildId: input.guildId, livePixConnectionId: connection.id },
  })

  return connection
}

async function create_livepix_oauth_authorization_with_dependencies(dependencies: livepix_connection_dependencies, input: {
  guildId: string
  userId: string
}) {
  assert_livepix_enabled(dependencies.config)

  const state = randomBytes(32).toString('base64url')
  await dependencies.db.supportOAuthState.create({
    data: {
      stateHash: hash_state(state),
      guildId: input.guildId,
      userId: input.userId,
      expiresAt: new Date(dependencies.now().getTime() + OAUTH_STATE_TTL_MS),
    },
  })

  return {
    authorizationUrl: build_livepix_authorization_url({
      clientId: dependencies.config.livePix.clientId,
      redirectUri: dependencies.config.livePix.oauthRedirectUri,
      state,
      scopes: LIVEPIX_REQUIRED_SCOPES,
    }),
  }
}

async function connect_livepix_owner_guild_with_dependencies(dependencies: livepix_connection_dependencies, input: {
  guildId: string
  userId: string
}) {
  assert_livepix_enabled(dependencies.config)

  if (!dependencies.config.livePix.ownerGuildIds.includes(input.guildId)) {
    throw new SupportApiError(403, 'Owner LivePix mode is not allowed for this guild')
  }

  const access_token = await dependencies.getOwnerAccessToken()
  const account = await dependencies.livepixClient.getAccount(access_token)

  const connection = await store_connected_account(dependencies, {
    guildId: input.guildId,
    connectedByUserId: input.userId,
    mode: LivePixConnectionMode.OWNER,
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    tokenExpiresAt: null,
    scopes: LIVEPIX_REQUIRED_SCOPES,
    providerWebhookId: null,
    account,
  })

  return serialize_livepix_connection(connection)
}

async function handle_livepix_oauth_callback_with_dependencies(dependencies: livepix_connection_dependencies, input: {
  code: string
  state: string
  log: FastifyBaseLogger
}) {
  assert_livepix_enabled(dependencies.config)

  const state_hash = hash_state(input.state)
  const state_row = await dependencies.db.supportOAuthState.findUnique({
    where: { stateHash: state_hash },
  })

  if (!state_row || state_row.usedAt || state_row.expiresAt.getTime() <= dependencies.now().getTime()) {
    throw new SupportApiError(400, 'Invalid or expired LivePix OAuth state')
  }

  const is_owner = dependencies.config.admin.ownerUserIds.includes(state_row.userId)
  if (!is_owner) {
    const admin = await dependencies.isGuildAdmin(state_row.guildId, state_row.userId, input.log)
    if (!admin.isAdmin) {
      throw new SupportApiError(403, 'User is no longer authorized for this guild')
    }
  }

  const claimed_at = dependencies.now()
  const claimed = await dependencies.db.supportOAuthState.updateMany({
    where: {
      id: state_row.id,
      usedAt: null,
      expiresAt: { gt: claimed_at },
    },
    data: { usedAt: claimed_at },
  })

  if (claimed.count !== 1) {
    throw new SupportApiError(400, 'LivePix OAuth state was already used')
  }

  const token = await dependencies.livepixClient.exchangeAuthorizationCode({
    clientId: dependencies.config.livePix.clientId,
    clientSecret: dependencies.config.livePix.clientSecret,
    code: input.code,
    redirectUri: dependencies.config.livePix.oauthRedirectUri,
  })

  const account = await dependencies.livepixClient.getAccount(token.accessToken)
  const token_expires_at = new Date(dependencies.now().getTime() + token.expiresIn * 1000)

  const connection = await store_connected_account(dependencies, {
    guildId: state_row.guildId,
    connectedByUserId: state_row.userId,
    mode: LivePixConnectionMode.OAUTH,
    accessTokenEncrypted: encrypt_livepix_secret(token.accessToken, dependencies.config.livePix.tokenEncryptionKey),
    refreshTokenEncrypted: token.refreshToken
      ? encrypt_livepix_secret(token.refreshToken, dependencies.config.livePix.tokenEncryptionKey)
      : null,
    tokenExpiresAt: token_expires_at,
    scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : LIVEPIX_REQUIRED_SCOPES,
    providerWebhookId: null,
    account,
  })

  return {
    guildId: state_row.guildId,
    connection: serialize_livepix_connection(connection),
    refreshTokenReturned: Boolean(token.refreshToken),
  }
}

async function disconnect_livepix_connection_with_dependencies(dependencies: livepix_connection_dependencies, guildId: string) {
  const connection = await dependencies.db.livePixConnection.findUnique({ where: { guildId } })
  if (!connection) return null

  await dependencies.db.guildSupportConfig.updateMany({
    where: { guildId, livePixConnectionId: connection.id },
    data: { livePixConnectionId: null },
  })

  const updated = await dependencies.db.livePixConnection.update({
    where: { id: connection.id },
    data: {
      status: LivePixConnectionStatus.DISCONNECTED,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
    },
  })

  return serialize_livepix_connection(updated)
}

export function create_livepix_connection_service(
  dependencies: livepix_connection_dependencies = default_livepix_connection_dependencies()
) {
  return {
    create_livepix_oauth_authorization: (input: { guildId: string; userId: string }) =>
      create_livepix_oauth_authorization_with_dependencies(dependencies, input),
    connect_livepix_owner_guild: (input: { guildId: string; userId: string }) =>
      connect_livepix_owner_guild_with_dependencies(dependencies, input),
    handle_livepix_oauth_callback: (input: { code: string; state: string; log: FastifyBaseLogger }) =>
      handle_livepix_oauth_callback_with_dependencies(dependencies, input),
    disconnect_livepix_connection: (guildId: string) =>
      disconnect_livepix_connection_with_dependencies(dependencies, guildId),
  }
}

export async function create_livepix_oauth_authorization(input: {
  guildId: string
  userId: string
}) {
  return create_livepix_connection_service().create_livepix_oauth_authorization(input)
}

export async function connect_livepix_owner_guild(input: {
  guildId: string
  userId: string
}) {
  return create_livepix_connection_service().connect_livepix_owner_guild(input)
}

export async function handle_livepix_oauth_callback(input: {
  code: string
  state: string
  log: FastifyBaseLogger
}) {
  return create_livepix_connection_service().handle_livepix_oauth_callback(input)
}

export async function disconnect_livepix_connection(guildId: string) {
  return create_livepix_connection_service().disconnect_livepix_connection(guildId)
}
