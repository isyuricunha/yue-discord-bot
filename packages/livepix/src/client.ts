export const LIVEPIX_API_BASE_URL = 'https://api.livepix.gg'
export const LIVEPIX_OAUTH_BASE_URL = 'https://oauth.livepix.gg'
export const LIVEPIX_AUTHORIZATION_URL = `${LIVEPIX_OAUTH_BASE_URL}/oauth2/auth`
export const LIVEPIX_TOKEN_URL = `${LIVEPIX_OAUTH_BASE_URL}/oauth2/token`
export const LIVEPIX_REQUIRED_SCOPES = ['account:read', 'payments:read', 'payments:write', 'webhooks'] as const

export type LivePixTokenResponse = {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  scope: string
  tokenType: string
}

export type LivePixAccount = {
  id: string
  email: string | null
  username: string
  displayName: string
  avatar: string | null
}

export type LivePixPayment = {
  id: string
  proof: string | null
  reference: string
  amount: number
  currency: string
  createdAt: string | null
}

export type LivePixPaymentCheckout = {
  reference: string
  redirectUrl: string
}

export type LivePixWebhook = {
  id: string
  url: string
  createdAt: string | null
}

export type LivePixRateLimit = {
  limit: number | null
  remaining: number | null
  reset: number | null
}

export class LivePixApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean
  readonly rateLimit: LivePixRateLimit

  constructor(input: {
    message: string
    status: number
    code: string
    retryable: boolean
    rateLimit?: LivePixRateLimit
  }) {
    super(input.message)
    this.name = 'LivePixApiError'
    this.status = input.status
    this.code = input.code
    this.retryable = input.retryable
    this.rateLimit = input.rateLimit ?? { limit: null, remaining: null, reset: null }
  }
}

export class LivePixNetworkError extends Error {
  readonly retryable = true

  constructor(message: string) {
    super(message)
    this.name = 'LivePixNetworkError'
  }
}

export class LivePixResponseError extends Error {
  readonly retryable = false

  constructor(message: string) {
    super(message)
    this.name = 'LivePixResponseError'
  }
}

type request_options = {
  method: 'GET' | 'POST'
  path: string
  accessToken?: string
  query?: Record<string, string | number | undefined>
  body?: unknown
}

type livepix_client_options = {
  apiBaseUrl?: string
  oauthBaseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optional_string(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function required_string(value: unknown, field: string): string {
  const parsed = optional_string(value)
  if (!parsed) throw new LivePixResponseError(`LivePix response is missing ${field}`)
  return parsed
}

function required_int(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new LivePixResponseError(`LivePix response is missing ${field}`)
  }
  return value
}

function parse_rate_limit(headers: Headers): LivePixRateLimit {
  const parse_header = (name: string) => {
    const value = headers.get(name)
    if (!value) return null
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return {
    limit: parse_header('x-ratelimit-limit'),
    remaining: parse_header('x-ratelimit-remaining'),
    reset: parse_header('x-ratelimit-reset'),
  }
}

function error_code_for_status(status: number): string {
  if (status === 401 || status === 403) return 'authorization_failed'
  if (status === 404) return 'not_found'
  if (status === 422) return 'validation_failed'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_unavailable'
  return 'provider_error'
}

function is_retryable_status(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function data_object(payload: unknown, label: string): Record<string, unknown> {
  if (!is_record(payload) || !is_record(payload.data)) {
    throw new LivePixResponseError(`Malformed LivePix ${label} response`)
  }
  return payload.data
}

function data_array(payload: unknown, label: string): unknown[] {
  if (!is_record(payload) || !Array.isArray(payload.data)) {
    throw new LivePixResponseError(`Malformed LivePix ${label} response`)
  }
  return payload.data
}

function parse_token_response(payload: unknown): LivePixTokenResponse {
  if (!is_record(payload)) {
    throw new LivePixResponseError('Malformed LivePix token response')
  }

  return {
    accessToken: required_string(payload.access_token, 'access_token'),
    refreshToken: optional_string(payload.refresh_token),
    expiresIn: required_int(payload.expires_in, 'expires_in'),
    scope: optional_string(payload.scope) ?? '',
    tokenType: optional_string(payload.token_type) ?? 'Bearer',
  }
}

function parse_account(payload: unknown): LivePixAccount {
  const data = data_object(payload, 'account')

  return {
    id: required_string(data.id, 'account.id'),
    email: optional_string(data.email),
    username: required_string(data.username, 'account.username'),
    displayName: required_string(data.displayName, 'account.displayName'),
    avatar: optional_string(data.avatar),
  }
}

function parse_payment_object(data: Record<string, unknown>): LivePixPayment {
  return {
    id: required_string(data.id, 'payment.id'),
    proof: optional_string(data.proof),
    reference: required_string(data.reference, 'payment.reference'),
    amount: required_int(data.amount, 'payment.amount'),
    currency: required_string(data.currency, 'payment.currency'),
    createdAt: optional_string(data.createdAt),
  }
}

function parse_payment(payload: unknown): LivePixPayment {
  return parse_payment_object(data_object(payload, 'payment'))
}

function parse_payment_checkout(payload: unknown): LivePixPaymentCheckout {
  const data = data_object(payload, 'payment checkout')
  return {
    reference: required_string(data.reference, 'payment.reference'),
    redirectUrl: required_string(data.redirectUrl, 'payment.redirectUrl'),
  }
}

function parse_webhook_object(data: Record<string, unknown>): LivePixWebhook {
  return {
    id: required_string(data.id, 'webhook.id'),
    url: required_string(data.url, 'webhook.url'),
    createdAt: optional_string(data.createdAt),
  }
}

function parse_scope(scopes: readonly string[]): string {
  return Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean))).join(' ')
}

export function build_livepix_authorization_url(input: {
  clientId: string
  redirectUri: string
  state: string
  scopes?: readonly string[]
  authorizationUrl?: string
}): string {
  const url = new URL(input.authorizationUrl ?? LIVEPIX_AUTHORIZATION_URL)
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', parse_scope(input.scopes ?? LIVEPIX_REQUIRED_SCOPES))
  url.searchParams.set('state', input.state)
  return url.toString()
}

export class LivePixClient {
  private readonly apiBaseUrl: string
  private readonly oauthBaseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: livepix_client_options = {}) {
    this.apiBaseUrl = (options.apiBaseUrl ?? LIVEPIX_API_BASE_URL).replace(/\/$/, '')
    this.oauthBaseUrl = (options.oauthBaseUrl ?? LIVEPIX_OAUTH_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async getClientCredentialsToken(input: {
    clientId: string
    clientSecret: string
    scopes?: readonly string[]
  }): Promise<LivePixTokenResponse> {
    return await this.requestToken({
      grant_type: 'client_credentials',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      scope: parse_scope(input.scopes ?? LIVEPIX_REQUIRED_SCOPES),
    })
  }

  async exchangeAuthorizationCode(input: {
    clientId: string
    clientSecret: string
    code: string
    redirectUri: string
  }): Promise<LivePixTokenResponse> {
    return await this.requestToken({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    })
  }

  async getAccount(accessToken: string): Promise<LivePixAccount> {
    return parse_account(await this.request({ method: 'GET', path: '/v2/account', accessToken }))
  }

  async createPayment(
    accessToken: string,
    input: { amount: number; currency: 'BRL'; redirectUrl: string }
  ): Promise<LivePixPaymentCheckout> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error('Payment amount must be a positive integer in cents')
    }

    return parse_payment_checkout(
      await this.request({
        method: 'POST',
        path: '/v2/payments',
        accessToken,
        body: {
          amount: input.amount,
          currency: input.currency,
          redirectUrl: input.redirectUrl,
        },
      })
    )
  }

  async getPayment(accessToken: string, paymentId: string): Promise<LivePixPayment> {
    return parse_payment(await this.request({ method: 'GET', path: `/v2/payments/${encodeURIComponent(paymentId)}`, accessToken }))
  }

  async listPayments(
    accessToken: string,
    input: { reference?: string; currency?: string; page?: number; limit?: number } = {}
  ): Promise<LivePixPayment[]> {
    const payload = await this.request({
      method: 'GET',
      path: '/v2/payments',
      accessToken,
      query: {
        reference: input.reference,
        currency: input.currency,
        page: input.page ?? 1,
        limit: input.limit ?? 20,
      },
    })

    return data_array(payload, 'payments').map((item) => {
      if (!is_record(item)) throw new LivePixResponseError('Malformed LivePix payment list item')
      return parse_payment_object(item)
    })
  }

  async findPaymentByReference(accessToken: string, reference: string): Promise<LivePixPayment | null> {
    const payments = await this.listPayments(accessToken, { reference, currency: 'BRL', page: 1, limit: 10 })
    return payments.find((payment) => payment.reference === reference) ?? null
  }

  async listWebhooks(accessToken: string): Promise<LivePixWebhook[]> {
    const payload = await this.request({
      method: 'GET',
      path: '/v2/webhooks',
      accessToken,
      query: { page: 1, limit: 100 },
    })

    return data_array(payload, 'webhooks').map((item) => {
      if (!is_record(item)) throw new LivePixResponseError('Malformed LivePix webhook list item')
      return parse_webhook_object(item)
    })
  }

  async createWebhook(accessToken: string, url: string): Promise<{ id: string }> {
    const data = data_object(
      await this.request({
        method: 'POST',
        path: '/v2/webhooks',
        accessToken,
        body: { url },
      }),
      'webhook create'
    )

    return { id: required_string(data.id, 'webhook.id') }
  }

  async ensureWebhook(accessToken: string, url: string): Promise<{ id: string; reused: boolean }> {
    const existing = (await this.listWebhooks(accessToken)).find((webhook) => webhook.url === url)
    if (existing) return { id: existing.id, reused: true }

    const created = await this.createWebhook(accessToken, url)
    return { id: created.id, reused: false }
  }

  private async requestToken(form: Record<string, string>): Promise<LivePixTokenResponse> {
    const payload = await this.fetchJson(`${this.oauthBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    })

    return parse_token_response(payload)
  }

  private async request(options: request_options): Promise<unknown> {
    const url = new URL(`${this.apiBaseUrl}${options.path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    return await this.fetchJson(url.toString(), {
      method: options.method,
      headers: {
        authorization: `Bearer ${options.accessToken}`,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  }

  private async fetchJson(url: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new LivePixApiError({
          message: `LivePix request failed with status ${response.status}`,
          status: response.status,
          code: error_code_for_status(response.status),
          retryable: is_retryable_status(response.status),
          rateLimit: parse_rate_limit(response.headers),
        })
      }

      return payload
    } catch (error) {
      if (error instanceof LivePixApiError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LivePixNetworkError('LivePix request timed out')
      }
      if (error instanceof LivePixResponseError) throw error
      throw new LivePixNetworkError('LivePix request failed')
    } finally {
      clearTimeout(timeout)
    }
  }
}

export class LivePixClientCredentialsTokenCache {
  private token: { accessToken: string; expiresAtMs: number } | null = null
  private inFlight: Promise<string> | null = null

  constructor(
    private readonly client: LivePixClient,
    private readonly credentials: {
      clientId: string
      clientSecret: string
      scopes?: readonly string[]
      refreshMarginMs?: number
    }
  ) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now()
    const margin = this.credentials.refreshMarginMs ?? 60_000
    if (this.token && this.token.expiresAtMs - margin > now) {
      return this.token.accessToken
    }

    if (this.inFlight) return await this.inFlight

    this.inFlight = this.client
      .getClientCredentialsToken({
        clientId: this.credentials.clientId,
        clientSecret: this.credentials.clientSecret,
        scopes: this.credentials.scopes,
      })
      .then((token) => {
        const expiresInMs = Math.max(0, token.expiresIn * 1000)
        this.token = {
          accessToken: token.accessToken,
          expiresAtMs: Date.now() + expiresInMs,
        }
        return token.accessToken
      })
      .finally(() => {
        this.inFlight = null
      })

    return await this.inFlight
  }

  clear(): void {
    this.token = null
    this.inFlight = null
  }
}
