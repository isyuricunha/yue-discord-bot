// Shared constants

export const MODERATION_ACTIONS = {
  BAN: 'ban',
  KICK: 'kick',
  WARN: 'warn',
  MUTE: 'mute',
  UNMUTE: 'unmute',
  TIMEOUT: 'timeout',
} as const;

export const AUTOMOD_ACTIONS = {
  WARN: 'warn',
  MUTE: 'mute',
  KICK: 'kick',
  BAN: 'ban',
  DELETE: 'delete',
} as const;

export const GIVEAWAY_FORMATS = {
  REACTION: 'reaction',
  LIST: 'list',
} as const;

export const GIVEAWAY_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
} as const;

// Discord limits
export const DISCORD_LIMITS = {
  MAX_EMBED_FIELDS: 25,
  MAX_EMBED_DESCRIPTION: 4096,
  MAX_EMBED_TITLE: 256,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_BULK_DELETE: 100,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

// Rate limits
export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 100,
  COMMANDS_PER_MINUTE: 10,
} as const;

// Defaults
export const DEFAULTS = {
  CAPS_THRESHOLD: 70,
  CAPS_MIN_LENGTH: 10,
  WARN_EXPIRATION_DAYS: 30,
  MUTE_ROLE_NAME: 'Muted',
  LOCALE: 'pt-BR',
  TIMEZONE: 'America/Sao_Paulo',
} as const;

// Colors for embeds
export const COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffaa00,
  INFO: 0x0099ff,
  BAN: 0xff0000,
  KICK: 0xff6600,
  WARN: 0xffaa00,
  MUTE: 0x666666,
  GIVEAWAY: 0x9b59b6,
} as const;

// Emojis
export const EMOJIS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  GIVEAWAY: '🎉',
  TROPHY: '🏆',
  LOCK: '🔒',
  UNLOCK: '🔓',
  BAN: '🔨',
  KICK: '👢',
  MUTE: '🔇',
} as const;
