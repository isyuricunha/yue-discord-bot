import type { Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

const BOT_SETTINGS_ID = 'global'

export type bot_app_description_settings = {
  appDescription: string | null
}

function normalize_optional_string(value: unknown, max_len: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max_len ? trimmed.slice(0, max_len) : trimmed
}

export function normalize_app_description_body(body: unknown): bot_app_description_settings | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const appDescription = normalize_optional_string(b.appDescription, 4000)

  return { appDescription }
}

async function get_app_description_settings(): Promise<bot_app_description_settings> {
  const row = await prisma.botSettings.findUnique({
    where: { id: BOT_SETTINGS_ID },
    select: { appDescription: true },
  })

  return {
    appDescription: typeof row?.appDescription === 'string' ? row.appDescription : null,
  }
}

export async function save_app_description_settings(
  settings: bot_app_description_settings
): Promise<bot_app_description_settings> {
  const updated = await prisma.botSettings.upsert({
    where: { id: BOT_SETTINGS_ID },
    update: { appDescription: settings.appDescription ?? null },
    create: { id: BOT_SETTINGS_ID, appDescription: settings.appDescription ?? null },
    select: { appDescription: true },
  })

  return {
    appDescription: typeof updated.appDescription === 'string' ? updated.appDescription : null,
  }
}

export async function apply_app_description(client: Client, settings: bot_app_description_settings): Promise<void> {
  const application = client.application
  if (!application) return

  try {
    await application.fetch().catch(() => null)

    await application.edit({
      description: settings.appDescription ?? '',
    })
  } catch (error: unknown) {
    logger.error({ err: safe_error_details(error) }, 'Failed to apply application description')
  }
}

export async function apply_startup_app_description(client: Client): Promise<void> {
  try {
    const settings = await get_app_description_settings()
    await apply_app_description(client, settings)
  } catch (error: unknown) {
    logger.error({ err: safe_error_details(error) }, 'Failed to apply startup application description')
  }
}
