import { CONFIG } from '../config'

async function fetch_internal_json(url: string, timeout_ms = 3_000): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeout_ms)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${CONFIG.internalApi.secret}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Internal readiness endpoint returned ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function check_bot_internal_api(): Promise<void> {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/health`
  const body = await fetch_internal_json(url) as { status?: unknown }
  if (body.status !== 'ok') {
    throw new Error('Internal bot API health response was not ok')
  }
}

export async function check_bot_client_ready(): Promise<void> {
  const url = `http://${CONFIG.botReadiness.host}:${CONFIG.botReadiness.port}/internal/ready`
  const body = await fetch_internal_json(url) as { status?: unknown; clientReady?: unknown }
  if (body.status !== 'ready' || body.clientReady !== true) {
    throw new Error('Discord client is not ready')
  }
}
