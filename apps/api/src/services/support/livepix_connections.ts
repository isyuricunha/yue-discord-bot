import { createHash, randomBytes } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import {
  build_livepix_authorization_url,
  encrypt_livepix_secret,
  LivePixClient,
  LivePixClientCredentialsTokenCache,
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

function hash_state(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

function assert_livepix_enabled() {
  if (!CONFIG.livePix.enabled) {
    throw new SupportApiError(503, 'LivePix is not configured')
  }

  parse_livepix_encryption_key(CONFIG.livePix.tokenEncryptionKey)
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

async function store_connected_account(input: {
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
  const connection = await prisma.livePixConnection.upsert({
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

  await prisma.guildSupportConfig.upsert({
    where: { guildId: input.guildId },
    update: { livePixConnectionId: connection.id },
    create: { guildId: input.guildId, livePixConnectionId: connection.id },
  })

  return connection
}

export async function create_livepix_oauth_authorization(input: {
  guildId: string
  userId: string
}) {
  assert_livepix_enabled()

  const state = randomBytes(32).toString('base64url')
  await prisma.supportOAuthState.create({
    data: {
      stateHash: hash_state(state),
      guildId: input.guildId,
      userId: input.userId,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  })

  return {
    authorizationUrl: build_livepix_authorization_url({
      clientId: CONFIG.livePix.clientId,
      redirectUri: CONFIG.livePix.oauthRedirectUri,
      state,
      scopes: LIVEPIX_REQUIRED_SCOPES,
    }),
  }
}

export async function connect_livepix_owner_guild(input: {
  guildId: string
  userId: string
}) {
  assert_livepix_enabled()

  if (!CONFIG.livePix.ownerGuildIds.includes(input.guildId)) {
    throw new SupportApiError(403, 'Owner LivePix mode is not allowed for this guild')
  }

  const access_token = await get_owner_token_cache().getAccessToken()
  const account = await livepix_client.getAccount(access_token)
  const webhook = await livepix_client.ensureWebhook(access_token, CONFIG.livePix.webhookUrl)

  const connection = await store_connected_account({
    guildId: input.guildId,
    connectedByUserId: input.userId,
    mode: LivePixConnectionMode.OWNER,
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    tokenExpiresAt: null,
    scopes: LIVEPIX_REQUIRED_SCOPES,
    providerWebhookId: webhook.id,
    account,
  })

  return serialize_livepix_connection(connection)
}

export async function handle_livepix_oauth_callback(input: {
  code: string
  state: string
  log: FastifyBaseLogger
}) {
  assert_livepix_enabled()

  const state_hash = hash_state(input.state)
  const state_row = await prisma.supportOAuthState.findUnique({
    where: { stateHash: state_hash },
  })

  if (!state_row || state_row.usedAt || state_row.expiresAt.getTime() <= Date.now()) {
    throw new SupportApiError(400, 'Invalid or expired LivePix OAuth state')
  }

  const is_owner = CONFIG.admin.ownerUserIds.includes(state_row.userId)
  if (!is_owner) {
    const admin = await is_guild_admin(state_row.guildId, state_row.userId, input.log)
    if (!admin.isAdmin) {
      throw new SupportApiError(403, 'User is no longer authorized for this guild')
    }
  }

  const claimed = await prisma.supportOAuthState.updateMany({
    where: {
      id: state_row.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  })

  if (claimed.count !== 1) {
    throw new SupportApiError(400, 'LivePix OAuth state was already used')
  }

  const token = await livepix_client.exchangeAuthorizationCode({
    clientId: CONFIG.livePix.clientId,
    clientSecret: CONFIG.livePix.clientSecret,
    code: input.code,
    redirectUri: CONFIG.livePix.oauthRedirectUri,
  })

  const account = await livepix_client.getAccount(token.accessToken)
  const webhook = await livepix_client.ensureWebhook(token.accessToken, CONFIG.livePix.webhookUrl)
  const token_expires_at = new Date(Date.now() + token.expiresIn * 1000)

  const connection = await store_connected_account({
    guildId: state_row.guildId,
    connectedByUserId: state_row.userId,
    mode: LivePixConnectionMode.OAUTH,
    accessTokenEncrypted: encrypt_livepix_secret(token.accessToken, CONFIG.livePix.tokenEncryptionKey),
    refreshTokenEncrypted: token.refreshToken
      ? encrypt_livepix_secret(token.refreshToken, CONFIG.livePix.tokenEncryptionKey)
      : null,
    tokenExpiresAt: token_expires_at,
    scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : LIVEPIX_REQUIRED_SCOPES,
    providerWebhookId: webhook.id,
    account,
  })

  return {
    guildId: state_row.guildId,
    connection: serialize_livepix_connection(connection),
    refreshTokenReturned: Boolean(token.refreshToken),
  }
}

export async function disconnect_livepix_connection(guildId: string) {
  const connection = await prisma.livePixConnection.findUnique({ where: { guildId } })
  if (!connection) return null

  await prisma.guildSupportConfig.updateMany({
    where: { guildId, livePixConnectionId: connection.id },
    data: { livePixConnectionId: null },
  })

  const updated = await prisma.livePixConnection.update({
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
