import { prisma } from '@yuebot/database'
import { discord_timeout_max_ms, duration_regex, parseDurationMs } from '@yuebot/shared'

const ALLOWED_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const
const ALLOWED_TIMEZONES = ['America/Sao_Paulo', 'America/New_York', 'Europe/London', 'Asia/Tokyo'] as const
const ALLOWED_ACTIONS = ['delete', 'warn', 'mute', 'kick', 'ban'] as const
const ALLOWED_ANTIRAID_ACTIONS = ['mute', 'kick', 'ban'] as const
const ALLOWED_AI_LEVELS = ['permissivo', 'brando', 'medio', 'rigoroso', 'maximo'] as const

const MIN_CAPS_THRESHOLD = 0
const MAX_CAPS_THRESHOLD = 100
const MIN_CAPS_LENGTH = 1
const MAX_DATABASE_INTEGER = 2_147_483_647
const MIN_JOIN_THRESHOLD = 3
const MAX_JOIN_THRESHOLD = 50
const MIN_JOIN_TIME_WINDOW_SECONDS = 10
const MAX_JOIN_TIME_WINDOW_SECONDS = 300
const MIN_MUTE_DURATION_MINUTES = 1
const MAX_MUTE_DURATION_MINUTES = 60
const MIN_COOLDOWN_SECONDS = 60
const MAX_COOLDOWN_SECONDS = 3_600

export const SUPPORTED_PANEL_MODULE_PAGE_KEYS = ['settings', 'welcome', 'automod', 'antiraid'] as const
export type supported_panel_module_page_key = (typeof SUPPORTED_PANEL_MODULE_PAGE_KEYS)[number]

type panel_module_logger = {
  warn: (object: Record<string, unknown>, message: string) => void
}

type panel_module_db = {
  guild: Pick<typeof prisma.guild, 'findUnique'>
  guildAntiRaidConfig: Pick<typeof prisma.guildAntiRaidConfig, 'findUnique'>
}

type raw_record = Record<string, unknown>

export type anti_raid_module_record = {
  enabled?: unknown
  joinThreshold?: unknown
  joinTimeWindow?: unknown
  action?: unknown
  duration?: unknown
  exemptRoles?: unknown
  exemptChannels?: unknown
  cooldown?: unknown
  notificationChannelId?: unknown
  raidActive?: unknown
  locked?: unknown
}

export type preload_result<T> =
  | { state: 'loaded'; value: T | null }
  | { state: 'failed' }

type available_settings_context = {
  pageKey: 'settings'
  status: 'available'
  configuration: {
    locale: (typeof ALLOWED_LOCALES)[number] | null
    timezone: (typeof ALLOWED_TIMEZONES)[number] | null
  }
}

type available_welcome_context = {
  pageKey: 'welcome'
  status: 'available'
  configuration: {
    welcomeChannelConfigured: boolean | null
    leaveChannelConfigured: boolean | null
  }
}

type available_automod_context = {
  pageKey: 'automod'
  status: 'available'
  configuration: {
    wordFilterEnabled: boolean | null
    blockedWordCount: number | null
    capsEnabled: boolean | null
    capsThreshold: number | null
    capsMinLength: number | null
    capsAction: (typeof ALLOWED_ACTIONS)[number] | null
    linkFilterEnabled: boolean | null
    blockAllLinks: boolean | null
    blockedDomainCount: number | null
    trustedDomainCount: number | null
    linkAction: (typeof ALLOWED_ACTIONS)[number] | null
    linkTimeoutDuration: string | null
    noRoleLinkProtectionEnabled: boolean | null
    noRoleAction: (typeof ALLOWED_ACTIONS)[number] | null
    noRoleTimeoutDuration: string | null
    linkNotificationsEnabled: boolean | null
    aiModerationEnabled: boolean | null
    aiModerationAction: (typeof ALLOWED_ACTIONS)[number] | null
    aiModerationLevel: (typeof ALLOWED_AI_LEVELS)[number] | null
  }
}

type available_antiraid_context = {
  pageKey: 'antiraid'
  status: 'available'
  configuration: {
    enabled: boolean | null
    joinThreshold: number | null
    joinTimeWindowSeconds: number | null
    configuredAction: (typeof ALLOWED_ANTIRAID_ACTIONS)[number] | null
    muteDurationMinutes: number | null
    exemptRoleCount: number | null
    exemptChannelCount: number | null
    cooldownSeconds: number | null
    notificationChannelConfigured: boolean | null
    raidCurrentlyActive: boolean | null
    serverCurrentlyLocked: boolean | null
  }
}

type unavailable_module_context = {
  pageKey: supported_panel_module_page_key
  status: 'unavailable'
}

export type panel_module_context =
  | available_settings_context
  | available_welcome_context
  | available_automod_context
  | available_antiraid_context
  | unavailable_module_context

export type panel_module_context_load_result = {
  moduleContext: panel_module_context | null
  antiRaid: preload_result<anti_raid_module_record>
}

function is_supported_panel_module_page_key(value: string | null | undefined): value is supported_panel_module_page_key {
  return typeof value === 'string' && SUPPORTED_PANEL_MODULE_PAGE_KEYS.includes(value as supported_panel_module_page_key)
}

function is_record(value: unknown): value is raw_record {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function to_record(value: unknown): raw_record | null {
  return is_record(value) ? value : null
}

function get_allowed_value<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : null
}

function get_boolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function get_integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null
}

function get_json_array_count(value: unknown): number | null {
  if (Array.isArray(value)) return value.length
  if (typeof value !== 'string') return null

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.length : null
  } catch {
    return null
  }
}

function validate_timeout(duration: unknown): string | null {
  if (typeof duration !== 'string') return null
  const trimmed = duration.trim().toLowerCase()
  if (!duration_regex.test(trimmed)) return null
  const milliseconds = parseDurationMs(trimmed)
  return milliseconds !== null && milliseconds <= discord_timeout_max_ms ? trimmed : null
}

function to_anti_raid_record(value: unknown): anti_raid_module_record | null {
  const record = to_record(value)
  return record ?? null
}

function unavailable(pageKey: supported_panel_module_page_key): unavailable_module_context {
  return { pageKey, status: 'unavailable' }
}

function get_config(guild: unknown): raw_record | null {
  const guildRecord = to_record(guild)
  return guildRecord ? to_record(guildRecord.config) : null
}

async function load_anti_raid_preload(
  db: panel_module_db,
  guildId: string,
  logger: panel_module_logger | undefined,
  pageKey: supported_panel_module_page_key | null,
): Promise<preload_result<anti_raid_module_record>> {
  try {
    const antiRaid = await db.guildAntiRaidConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        joinThreshold: true,
        joinTimeWindow: true,
        action: true,
        duration: true,
        exemptRoles: true,
        exemptChannels: true,
        cooldown: true,
        notificationChannelId: true,
        raidActive: true,
        locked: true,
      },
    })
    return { state: 'loaded', value: to_anti_raid_record(antiRaid) }
  } catch (error: unknown) {
    logger?.warn(
      { guildId, ...(pageKey ? { pageKey } : {}), error: 'database read failed' },
      'Failed to load optional Anti-Raid context',
    )
    return { state: 'failed' }
  }
}

async function load_guild_config(
  db: panel_module_db,
  guildId: string,
  select: Record<string, true>,
): Promise<raw_record | null> {
  const guild = await db.guild.findUnique({
    where: { id: guildId },
    select: { config: { select } },
  })
  return get_config(guild)
}

async function load_settings_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const config = await load_guild_config(db, guildId, { locale: true, timezone: true })
  if (!config) return unavailable('settings')

  return {
    pageKey: 'settings',
    status: 'available',
    configuration: {
      locale: get_allowed_value(config.locale, ALLOWED_LOCALES),
      timezone: get_allowed_value(config.timezone, ALLOWED_TIMEZONES),
    },
  }
}

async function load_welcome_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const config = await load_guild_config(db, guildId, { welcomeChannelId: true, leaveChannelId: true })
  if (!config) return unavailable('welcome')

  return {
    pageKey: 'welcome',
    status: 'available',
    configuration: {
      welcomeChannelConfigured: config.welcomeChannelId === null ? false : typeof config.welcomeChannelId === 'string' ? true : null,
      leaveChannelConfigured: config.leaveChannelId === null ? false : typeof config.leaveChannelId === 'string' ? true : null,
    },
  }
}

async function load_automod_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const config = await load_guild_config(db, guildId, {
    wordFilterEnabled: true,
    bannedWords: true,
    capsEnabled: true,
    capsThreshold: true,
    capsMinLength: true,
    capsAction: true,
    linkFilterEnabled: true,
    linkBlockAll: true,
    bannedDomains: true,
    allowedDomains: true,
    linkAction: true,
    linkTimeoutDuration: true,
    linkNoRoleEnabled: true,
    linkNoRoleAction: true,
    linkNoRoleTimeoutDuration: true,
    linkNotifyEnabled: true,
    aiModerationEnabled: true,
    aiModerationAction: true,
    aiModerationLevel: true,
  })
  if (!config) return unavailable('automod')

  const linkAction = get_allowed_value(config.linkAction, ALLOWED_ACTIONS)
  const noRoleAction = get_allowed_value(config.linkNoRoleAction, ALLOWED_ACTIONS)

  return {
    pageKey: 'automod',
    status: 'available',
    configuration: {
      wordFilterEnabled: get_boolean(config.wordFilterEnabled),
      blockedWordCount: get_json_array_count(config.bannedWords),
      capsEnabled: get_boolean(config.capsEnabled),
      capsThreshold: get_integer(config.capsThreshold, MIN_CAPS_THRESHOLD, MAX_CAPS_THRESHOLD),
      capsMinLength: get_integer(config.capsMinLength, MIN_CAPS_LENGTH, MAX_DATABASE_INTEGER),
      capsAction: get_allowed_value(config.capsAction, ALLOWED_ACTIONS),
      linkFilterEnabled: get_boolean(config.linkFilterEnabled),
      blockAllLinks: get_boolean(config.linkBlockAll),
      blockedDomainCount: get_json_array_count(config.bannedDomains),
      trustedDomainCount: get_json_array_count(config.allowedDomains),
      linkAction,
      linkTimeoutDuration: linkAction === 'mute' ? validate_timeout(config.linkTimeoutDuration) : null,
      noRoleLinkProtectionEnabled: get_boolean(config.linkNoRoleEnabled),
      noRoleAction,
      noRoleTimeoutDuration: noRoleAction === 'mute' ? validate_timeout(config.linkNoRoleTimeoutDuration) : null,
      linkNotificationsEnabled: get_boolean(config.linkNotifyEnabled),
      aiModerationEnabled: get_boolean(config.aiModerationEnabled),
      aiModerationAction: get_allowed_value(config.aiModerationAction, ALLOWED_ACTIONS),
      aiModerationLevel: get_allowed_value(config.aiModerationLevel, ALLOWED_AI_LEVELS),
    },
  }
}

function load_antiraid_context(preload: preload_result<anti_raid_module_record>): panel_module_context {
  if (preload.state === 'failed' || preload.value === null) return unavailable('antiraid')

  const antiRaid = preload.value
  const configuredAction = get_allowed_value(antiRaid.action, ALLOWED_ANTIRAID_ACTIONS)

  return {
    pageKey: 'antiraid',
    status: 'available',
    configuration: {
      enabled: get_boolean(antiRaid.enabled),
      joinThreshold: get_integer(antiRaid.joinThreshold, MIN_JOIN_THRESHOLD, MAX_JOIN_THRESHOLD),
      joinTimeWindowSeconds: get_integer(antiRaid.joinTimeWindow, MIN_JOIN_TIME_WINDOW_SECONDS, MAX_JOIN_TIME_WINDOW_SECONDS),
      configuredAction,
      muteDurationMinutes: configuredAction === 'mute'
        ? get_integer(antiRaid.duration, MIN_MUTE_DURATION_MINUTES, MAX_MUTE_DURATION_MINUTES)
        : null,
      exemptRoleCount: get_json_array_count(antiRaid.exemptRoles),
      exemptChannelCount: get_json_array_count(antiRaid.exemptChannels),
      cooldownSeconds: get_integer(antiRaid.cooldown, MIN_COOLDOWN_SECONDS, MAX_COOLDOWN_SECONDS),
      notificationChannelConfigured: antiRaid.notificationChannelId === null
        ? false
        : typeof antiRaid.notificationChannelId === 'string'
          ? true
          : null,
      raidCurrentlyActive: get_boolean(antiRaid.raidActive),
      serverCurrentlyLocked: get_boolean(antiRaid.locked),
    },
  }
}

export async function load_panel_module_context(params: {
  pageKey: string | null | undefined
  guildId: string
  db: panel_module_db
  logger?: panel_module_logger
}): Promise<panel_module_context_load_result> {
  const pageKey = is_supported_panel_module_page_key(params.pageKey) ? params.pageKey : null
  const antiRaid = await load_anti_raid_preload(params.db, params.guildId, params.logger, pageKey)

  if (!pageKey) return { moduleContext: null, antiRaid }

  try {
    const moduleContext = pageKey === 'settings'
      ? await load_settings_context(params.db, params.guildId)
      : pageKey === 'welcome'
        ? await load_welcome_context(params.db, params.guildId)
        : pageKey === 'automod'
          ? await load_automod_context(params.db, params.guildId)
          : load_antiraid_context(antiRaid)
    return { moduleContext, antiRaid }
  } catch (error: unknown) {
    params.logger?.warn(
      { guildId: params.guildId, pageKey, error: 'database read failed' },
      'Failed to load optional panel module context',
    )
    return { moduleContext: unavailable(pageKey), antiRaid }
  }
}
