import { load_env } from '@yuebot/shared';
import { parse_livepix_encryption_key } from '@yuebot/livepix';

load_env();

function parse_int_env(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function parse_csv_env(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parse_boolean_env(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function required_env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variável de ambiente faltando: ${name}\n` +
        `Por favor, configure o arquivo .env baseado no .env.example`
    )
  }
  return value
}

function required_env_one_of(names: string[], label: string): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  throw new Error(
    `Variável de ambiente faltando: ${label}\n` +
      `Por favor, configure o arquivo .env baseado no .env.example`
  )
}

export const CONFIG = {
  discord: {
    token: process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  internalApi: {
    host: process.env.BOT_INTERNAL_BIND_HOST || process.env.BOT_INTERNAL_HOST || '127.0.0.1',
    port: parse_int_env(process.env.BOT_INTERNAL_PORT, 3100),
    secret: process.env.INTERNAL_API_SECRET || '',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  admin: {
    ownerUserIds: parse_csv_env(process.env.OWNER_USER_IDS),
    badgeAdminUserIds: parse_csv_env(process.env.BADGE_ADMIN_USER_IDS),
    fanArtReviewerUserIds: parse_csv_env(process.env.FAN_ART_REVIEWER_USER_IDS),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  livePix: {
    enabled: parse_boolean_env(process.env.LIVEPIX_ENABLED, false),
    clientId: process.env.LIVEPIX_CLIENT_ID || '',
    clientSecret: process.env.LIVEPIX_CLIENT_SECRET || '',
    paymentReturnUrl: process.env.LIVEPIX_PAYMENT_RETURN_URL || process.env.LIVEPIX_RETURN_URL || '',
    tokenEncryptionKey: process.env.LIVEPIX_TOKEN_ENCRYPTION_KEY || '',
    ownerGuildIds: parse_csv_env(process.env.LIVEPIX_OWNER_GUILD_IDS),
  },
} as const;

export function assert_deploy_commands_env(): void {
  required_env('DISCORD_CLIENT_ID')
  required_env_one_of(['DISCORD_TOKEN', 'DISCORD_BOT_TOKEN'], 'DISCORD_TOKEN (ou DISCORD_BOT_TOKEN)')
}

export function assert_bot_runtime_env(): void {
  required_env('DISCORD_CLIENT_ID')
  required_env_one_of(['DISCORD_TOKEN', 'DISCORD_BOT_TOKEN'], 'DISCORD_TOKEN (ou DISCORD_BOT_TOKEN)')
  required_env('DATABASE_URL')
  required_env('INTERNAL_API_SECRET')

  if ((process.env.INTERNAL_API_SECRET ?? '').length < 32) {
    throw new Error('INTERNAL_API_SECRET deve ter no mínimo 32 caracteres')
  }

  if (parse_boolean_env(process.env.LIVEPIX_ENABLED, false)) {
    const missing = [
      'LIVEPIX_CLIENT_ID',
      'LIVEPIX_CLIENT_SECRET',
      'LIVEPIX_TOKEN_ENCRYPTION_KEY',
    ].filter((key) => !process.env[key])

    if (!process.env.LIVEPIX_PAYMENT_RETURN_URL && !process.env.LIVEPIX_RETURN_URL) {
      missing.push('LIVEPIX_PAYMENT_RETURN_URL')
    }

    if (missing.length > 0) {
      throw new Error(`Variáveis de ambiente LivePix faltando: ${missing.join(', ')}`)
    }

    try {
      parse_livepix_encryption_key(process.env.LIVEPIX_TOKEN_ENCRYPTION_KEY ?? '')
    } catch {
      throw new Error('LIVEPIX_TOKEN_ENCRYPTION_KEY deve decodificar para 32 bytes')
    }
  }
}
