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

// Colors for embeds (YuTheme v2 palette: accent #d6a84f, success #31d158,
// danger #ff6961, info #64d2ff, muted text #8e887c)
export const COLORS = {
  SUCCESS: 0x31d158,
  ERROR: 0xff6961,
  WARNING: 0xd6a84f,
  INFO: 0x64d2ff,
  BAN: 0xff6961,
  KICK: 0xff6961,
  WARN: 0xd6a84f,
  MUTE: 0x8e887c,
  GIVEAWAY: 0xd6a84f,
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
  BANK: '🏦',
  MONEY: '💰',
} as const;

// Bank constants
export const BANK = {
  DEFAULT_INTEREST_RATE: 0.03, // 3% daily interest
  MINIMUM_BALANCE_FOR_INTEREST: 100n, // Minimum 100 luazinhas to earn interest
  INTEREST_INTERVAL_HOURS: 24, // Interest accrues every 24 hours
} as const;
