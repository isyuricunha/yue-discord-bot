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

export const SUPPORTED_PANEL_MODULE_PAGE_KEYS = [
  'settings',
  'welcome',
  'automod',
  'antiraid',
  'xp',
  'autorole',
  'tickets',
  'commands',
  'suggestions',
  'reaction-roles',
  'starboard',
  'free-games',
  'modlogs',
  'giveaways',
  'giveaway-create',
  'giveaway-details',
  'members',
  'member-details',
] as const
export type supported_panel_module_page_key = (typeof SUPPORTED_PANEL_MODULE_PAGE_KEYS)[number]

type panel_module_logger = {
  warn: (object: Record<string, unknown>, message: string) => void
}

export type panel_module_db = Pick<
  typeof prisma,
  | 'guild'
  | 'guildAntiRaidConfig'
  | 'guildXpConfig'
  | 'guildLevelRoleReward'
  | 'guildAutoroleConfig'
  | 'guildAutoroleRole'
  | 'ticketConfig'
  | 'ticket'
  | 'guildCommandOverride'
  | 'guildCommandCooldown'
  | 'suggestionConfig'
  | 'suggestion'
  | 'reactionRolePanel'
  | 'starboardConfig'
  | 'starboardPost'
  | 'freeGameNotification'
  | 'modLog'
  | 'giveaway'
  | 'guildMember'
>

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

type available_context<K extends supported_panel_module_page_key, C extends Record<string, unknown>> = {
  pageKey: K
  status: 'available'
  configuration: C
}

type available_settings_context = available_context<'settings', {
  locale: (typeof ALLOWED_LOCALES)[number] | null
  timezone: (typeof ALLOWED_TIMEZONES)[number] | null
}>

type available_welcome_context = available_context<'welcome', {
  welcomeChannelConfigured: boolean | null
  leaveChannelConfigured: boolean | null
}>

type available_automod_context = available_context<'automod', {
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
}>

type available_antiraid_context = available_context<'antiraid', {
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
}>

type available_xp_context = available_context<'xp', {
  enabled: boolean | null
  xpMode: string | null
  xpPerMessage: number | null
  xpPerVoiceMinute: number | null
  dailyXpBonusEnabled: boolean | null
  dailyXpBonusAmount: number | null
  voiceXpEnabled: boolean | null
  rewardMode: string | null
  rewardCount: number
  ignoredChannelCount: number | null
  ignoredRoleCount: number | null
  levelUpChannelConfigured: boolean | null
}>

type available_autorole_context = available_context<'autorole', {
  enabled: boolean | null
  delaySeconds: number | null
  onlyAfterFirstMessage: boolean | null
  roleCount: number
}>

type available_tickets_context = available_context<'tickets', {
  enabled: boolean | null
  categoryConfigured: boolean | null
  logChannelConfigured: boolean | null
  supportRoleCount: number | null
  panelChannelConfigured: boolean | null
  openTicketCount: number
  closedTicketCount: number
}>

type available_commands_context = available_context<'commands', {
  disabledOverrideCount: number
  customCooldownCount: number
}>

type available_suggestions_context = available_context<'suggestions', {
  enabled: boolean | null
  channelConfigured: boolean | null
  logChannelConfigured: boolean | null
  pendingCount: number
  acceptedCount: number
  deniedCount: number
}>

type available_reaction_roles_context = available_context<'reaction-roles', {
  panelCount: number
  enabledPanelCount: number
  publishedPanelCount: number
  itemCount: number
}>

type available_starboard_context = available_context<'starboard', {
  enabled: boolean | null
  channelConfigured: boolean | null
  emoji: string | null
  threshold: number | null
  ignoreBots: boolean | null
  postCount: number
}>

type available_free_games_context = available_context<'free-games', {
  enabled: boolean | null
  channelConfigured: boolean | null
  mentionRoleCount: number | null
  platformCount: number | null
  giveawayTypeCount: number | null
}>

type available_modlogs_context = available_context<'modlogs', {
  logChannelConfigured: boolean | null
  totalRecordCount: number
  recent24hCount: number
}>

type giveaway_page_key = 'giveaways' | 'giveaway-create' | 'giveaway-details'
type available_giveaways_context = available_context<giveaway_page_key, {
  channelConfigured: boolean | null
  activeCount: number
  endedCount: number
  cancelledCount: number
}>

type member_page_key = 'members' | 'member-details'
type available_members_context = available_context<member_page_key, {
  cachedMemberCount: number
  membersWithWarningsCount: number
}>

type unavailable_module_context = {
  pageKey: supported_panel_module_page_key
  status: 'unavailable'
}

export type panel_module_context =
  | available_settings_context
  | available_welcome_context
  | available_automod_context
  | available_antiraid_context
  | available_xp_context
  | available_autorole_context
  | available_tickets_context
  | available_commands_context
  | available_suggestions_context
  | available_reaction_roles_context
  | available_starboard_context
  | available_free_games_context
  | available_modlogs_context
  | available_giveaways_context
  | available_members_context
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

function get_short_string(value: unknown, max = 64): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= max && !/[\r\n<>]/.test(trimmed) ? trimmed : null
}

function get_boolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function get_integer(value: unknown, minimum = 0, maximum = MAX_DATABASE_INTEGER): number | null {
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

function configured(value: unknown): boolean | null {
  if (value === null) return false
  return typeof value === 'string' ? value.trim().length > 0 : null
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
  } catch {
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
      welcomeChannelConfigured: configured(config.welcomeChannelId),
      leaveChannelConfigured: configured(config.leaveChannelId),
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
      notificationChannelConfigured: configured(antiRaid.notificationChannelId),
      raidCurrentlyActive: get_boolean(antiRaid.raidActive),
      serverCurrentlyLocked: get_boolean(antiRaid.locked),
    },
  }
}

async function load_xp_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [config, rewardCount] = await Promise.all([
    db.guildXpConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        xpMode: true,
        xpPerMessage: true,
        xpPerVoiceMinute: true,
        dailyXpBonusEnabled: true,
        dailyXpBonusAmount: true,
        voiceXpEnabled: true,
        rewardMode: true,
        ignoredChannelIds: true,
        ignoredRoleIds: true,
        levelUpChannelId: true,
      },
    }),
    db.guildLevelRoleReward.count({ where: { guildId } }),
  ])
  if (!config) return unavailable('xp')
  return {
    pageKey: 'xp',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.enabled),
      xpMode: get_short_string(config.xpMode),
      xpPerMessage: get_integer(config.xpPerMessage),
      xpPerVoiceMinute: get_integer(config.xpPerVoiceMinute),
      dailyXpBonusEnabled: get_boolean(config.dailyXpBonusEnabled),
      dailyXpBonusAmount: get_integer(config.dailyXpBonusAmount),
      voiceXpEnabled: get_boolean(config.voiceXpEnabled),
      rewardMode: get_short_string(config.rewardMode),
      rewardCount,
      ignoredChannelCount: get_json_array_count(config.ignoredChannelIds),
      ignoredRoleCount: get_json_array_count(config.ignoredRoleIds),
      levelUpChannelConfigured: configured(config.levelUpChannelId),
    },
  }
}

async function load_autorole_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [config, roleCount] = await Promise.all([
    db.guildAutoroleConfig.findUnique({
      where: { guildId },
      select: { enabled: true, delaySeconds: true, onlyAfterFirstMessage: true },
    }),
    db.guildAutoroleRole.count({ where: { guildId } }),
  ])
  if (!config) return unavailable('autorole')
  return {
    pageKey: 'autorole',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.enabled),
      delaySeconds: get_integer(config.delaySeconds),
      onlyAfterFirstMessage: get_boolean(config.onlyAfterFirstMessage),
      roleCount,
    },
  }
}

async function load_tickets_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [config, openTicketCount, closedTicketCount] = await Promise.all([
    db.ticketConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
      },
    }),
    db.ticket.count({ where: { guildId, status: 'open' } }),
    db.ticket.count({ where: { guildId, status: 'closed' } }),
  ])
  if (!config) return unavailable('tickets')
  return {
    pageKey: 'tickets',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.enabled),
      categoryConfigured: configured(config.categoryId),
      logChannelConfigured: configured(config.logChannelId),
      supportRoleCount: get_json_array_count(config.supportRoleIds),
      panelChannelConfigured: configured(config.panelChannelId),
      openTicketCount,
      closedTicketCount,
    },
  }
}

async function load_commands_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [disabledOverrideCount, customCooldownCount] = await Promise.all([
    db.guildCommandOverride.count({ where: { guildId, enabled: false } }),
    db.guildCommandCooldown.count({ where: { guildId } }),
  ])
  return {
    pageKey: 'commands',
    status: 'available',
    configuration: { disabledOverrideCount, customCooldownCount },
  }
}

async function load_suggestions_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [config, pendingCount, acceptedCount, deniedCount] = await Promise.all([
    db.suggestionConfig.findUnique({ where: { guildId }, select: { enabled: true, channelId: true, logChannelId: true } }),
    db.suggestion.count({ where: { guildId, status: 'pending' } }),
    db.suggestion.count({ where: { guildId, status: 'accepted' } }),
    db.suggestion.count({ where: { guildId, status: 'denied' } }),
  ])
  if (!config) return unavailable('suggestions')
  return {
    pageKey: 'suggestions',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.enabled),
      channelConfigured: configured(config.channelId),
      logChannelConfigured: configured(config.logChannelId),
      pendingCount,
      acceptedCount,
      deniedCount,
    },
  }
}

async function load_reaction_roles_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const panels = await db.reactionRolePanel.findMany({
    where: { guildId },
    select: { enabled: true, messageId: true, _count: { select: { items: true } } },
  })
  return {
    pageKey: 'reaction-roles',
    status: 'available',
    configuration: {
      panelCount: panels.length,
      enabledPanelCount: panels.filter((panel) => panel.enabled).length,
      publishedPanelCount: panels.filter((panel) => Boolean(panel.messageId)).length,
      itemCount: panels.reduce((total, panel) => total + panel._count.items, 0),
    },
  }
}

async function load_starboard_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const [config, postCount] = await Promise.all([
    db.starboardConfig.findUnique({
      where: { guildId },
      select: { enabled: true, channelId: true, emoji: true, threshold: true, ignoreBots: true },
    }),
    db.starboardPost.count({ where: { guildId } }),
  ])
  if (!config) return unavailable('starboard')
  return {
    pageKey: 'starboard',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.enabled),
      channelConfigured: configured(config.channelId),
      emoji: get_short_string(config.emoji, 16),
      threshold: get_integer(config.threshold, 1, 100),
      ignoreBots: get_boolean(config.ignoreBots),
      postCount,
    },
  }
}

async function load_free_games_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const config = await db.freeGameNotification.findUnique({
    where: { guildId },
    select: { isEnabled: true, channelId: true, roleIds: true, platforms: true, giveawayTypes: true },
  })
  if (!config) return unavailable('free-games')
  return {
    pageKey: 'free-games',
    status: 'available',
    configuration: {
      enabled: get_boolean(config.isEnabled),
      channelConfigured: configured(config.channelId),
      mentionRoleCount: get_json_array_count(config.roleIds),
      platformCount: get_json_array_count(config.platforms),
      giveawayTypeCount: get_json_array_count(config.giveawayTypes),
    },
  }
}

async function load_modlogs_context(db: panel_module_db, guildId: string): Promise<panel_module_context> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [config, totalRecordCount, recent24hCount] = await Promise.all([
    load_guild_config(db, guildId, { modLogChannelId: true }),
    db.modLog.count({ where: { guildId } }),
    db.modLog.count({ where: { guildId, createdAt: { gte: since } } }),
  ])
  if (!config) return unavailable('modlogs')
  return {
    pageKey: 'modlogs',
    status: 'available',
    configuration: {
      logChannelConfigured: configured(config.modLogChannelId),
      totalRecordCount,
      recent24hCount,
    },
  }
}

async function load_giveaways_context(
  db: panel_module_db,
  guildId: string,
  pageKey: giveaway_page_key,
): Promise<panel_module_context> {
  const [config, activeCount, endedCount, cancelledCount] = await Promise.all([
    load_guild_config(db, guildId, { giveawayChannelId: true }),
    db.giveaway.count({ where: { guildId, ended: false, cancelled: false } }),
    db.giveaway.count({ where: { guildId, ended: true, cancelled: false } }),
    db.giveaway.count({ where: { guildId, cancelled: true } }),
  ])
  if (!config) return unavailable(pageKey)
  return {
    pageKey,
    status: 'available',
    configuration: {
      channelConfigured: configured(config.giveawayChannelId),
      activeCount,
      endedCount,
      cancelledCount,
    },
  }
}

async function load_members_context(
  db: panel_module_db,
  guildId: string,
  pageKey: member_page_key,
): Promise<panel_module_context> {
  const [cachedMemberCount, membersWithWarningsCount] = await Promise.all([
    db.guildMember.count({ where: { guildId } }),
    db.guildMember.count({ where: { guildId, warnings: { gt: 0 } } }),
  ])
  return {
    pageKey,
    status: 'available',
    configuration: { cachedMemberCount, membersWithWarningsCount },
  }
}

async function load_page_context(
  db: panel_module_db,
  guildId: string,
  pageKey: supported_panel_module_page_key,
  antiRaid: preload_result<anti_raid_module_record>,
): Promise<panel_module_context> {
  switch (pageKey) {
    case 'settings': return load_settings_context(db, guildId)
    case 'welcome': return load_welcome_context(db, guildId)
    case 'automod': return load_automod_context(db, guildId)
    case 'antiraid': return load_antiraid_context(antiRaid)
    case 'xp': return load_xp_context(db, guildId)
    case 'autorole': return load_autorole_context(db, guildId)
    case 'tickets': return load_tickets_context(db, guildId)
    case 'commands': return load_commands_context(db, guildId)
    case 'suggestions': return load_suggestions_context(db, guildId)
    case 'reaction-roles': return load_reaction_roles_context(db, guildId)
    case 'starboard': return load_starboard_context(db, guildId)
    case 'free-games': return load_free_games_context(db, guildId)
    case 'modlogs': return load_modlogs_context(db, guildId)
    case 'giveaways':
    case 'giveaway-create':
    case 'giveaway-details':
      return load_giveaways_context(db, guildId, pageKey)
    case 'members':
    case 'member-details':
      return load_members_context(db, guildId, pageKey)
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
    return {
      moduleContext: await load_page_context(params.db, params.guildId, pageKey, antiRaid),
      antiRaid,
    }
  } catch {
    params.logger?.warn(
      { guildId: params.guildId, pageKey, error: 'database read failed' },
      'Failed to load optional panel module context',
    )
    return { moduleContext: unavailable(pageKey), antiRaid }
  }
}
