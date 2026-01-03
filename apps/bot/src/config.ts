import { load_env } from '@yuebot/shared';

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
    host: process.env.BOT_INTERNAL_HOST || '127.0.0.1',
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
}
