import { ActivityType } from 'discord.js'
import type { Client, PresenceStatusData } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

const BOT_SETTINGS_ID = 'global'

export type bot_presence_settings = {
  presenceEnabled: boolean
  presenceStatus: PresenceStatusData
  activityType: 'playing' | 'streaming' | 'listening' | 'watching' | 'competing' | null
  activityName: string | null
  activityUrl: string | null
}

function parse_status(value: unknown): PresenceStatusData {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'online' || raw === 'idle' || raw === 'dnd' || raw === 'invisible') return raw
  return 'online'
}

function parse_activity_type(value: unknown): bot_presence_settings['activityType'] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'playing' || raw === 'streaming' || raw === 'listening' || raw === 'watching' || raw === 'competing') return raw
  return null
}

function normalize_optional_string(value: unknown, max_len: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max_len ? trimmed.slice(0, max_len) : trimmed
}

function normalize_optional_url(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function normalize_presence_body(body: unknown): bot_presence_settings | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  if (typeof b.presenceEnabled !== 'boolean') return null

  const presenceStatus = parse_status(b.presenceStatus)

  const activityType = parse_activity_type(b.activityType)
  const activityName = normalize_optional_string(b.activityName, 128)
  const activityUrl = normalize_optional_url(b.activityUrl)

  if (activityType === 'streaming' && activityName && !activityUrl) {
    return null
  }

  return {
    presenceEnabled: b.presenceEnabled,
    presenceStatus,
    activityType,
    activityName,
    activityUrl,
  }
}

export async function get_presence_settings(): Promise<bot_presence_settings> {
  const row = await prisma.botSettings.findUnique({
    where: { id: BOT_SETTINGS_ID },
    select: {
      presenceEnabled: true,
      presenceStatus: true,
      activityType: true,
      activityName: true,
      activityUrl: true,
    },
  })

  return {
    presenceEnabled: row?.presenceEnabled ?? false,
    presenceStatus: parse_status(row?.presenceStatus),
    activityType: parse_activity_type(row?.activityType),
    activityName: typeof row?.activityName === 'string' ? row.activityName : null,
    activityUrl: typeof row?.activityUrl === 'string' ? row.activityUrl : null,
  }
}

export async function save_presence_settings(settings: bot_presence_settings): Promise<bot_presence_settings> {
  const updated = await prisma.botSettings.upsert({
    where: { id: BOT_SETTINGS_ID },
    update: {
      presenceEnabled: settings.presenceEnabled,
      presenceStatus: settings.presenceStatus,
      activityType: settings.activityType,
      activityName: settings.activityName,
      activityUrl: settings.activityUrl,
    },
    create: {
      id: BOT_SETTINGS_ID,
      presenceEnabled: settings.presenceEnabled,
      presenceStatus: settings.presenceStatus,
      activityType: settings.activityType,
      activityName: settings.activityName,
      activityUrl: settings.activityUrl,
    },
    select: {
      presenceEnabled: true,
      presenceStatus: true,
      activityType: true,
      activityName: true,
      activityUrl: true,
    },
  })

  return {
    presenceEnabled: updated.presenceEnabled,
    presenceStatus: parse_status(updated.presenceStatus),
    activityType: parse_activity_type(updated.activityType),
    activityName: typeof updated.activityName === 'string' ? updated.activityName : null,
    activityUrl: typeof updated.activityUrl === 'string' ? updated.activityUrl : null,
  }
}

export function apply_presence(client: Client, settings: bot_presence_settings): void {
  const user = client.user
  if (!user) return

  const activities: Array<{ type: ActivityType; name: string; url?: string }> = []

  if (settings.presenceEnabled) {
    const name = typeof settings.activityName === 'string' ? settings.activityName.trim() : ''

    if (name && settings.activityType) {
      const type_map: Record<NonNullable<bot_presence_settings['activityType']>, ActivityType> = {
        playing: ActivityType.Playing,
        streaming: ActivityType.Streaming,
        listening: ActivityType.Listening,
        watching: ActivityType.Watching,
        competing: ActivityType.Competing,
      }

      const activity_type = type_map[settings.activityType]

      if (settings.activityType === 'streaming') {
        const url = typeof settings.activityUrl === 'string' ? settings.activityUrl.trim() : ''
        if (url) {
          activities.push({ type: activity_type, name, url })
        }
      } else {
        activities.push({ type: activity_type, name })
      }
    }
  }

  user.setPresence({ status: settings.presenceStatus, activities })
}

export async function apply_startup_presence(client: Client): Promise<void> {
  try {
    const settings = await get_presence_settings()
    apply_presence(client, settings)
  } catch (error: unknown) {
    logger.error({ err: safe_error_details(error) }, 'Failed to apply startup presence')
  }
}
