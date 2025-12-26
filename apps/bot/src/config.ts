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

export const CONFIG = {
  discord: {
    token: (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN)!,
    clientId: process.env.DISCORD_CLIENT_ID!,
  },
  internalApi: {
    host: process.env.BOT_INTERNAL_HOST || '127.0.0.1',
    port: parse_int_env(process.env.BOT_INTERNAL_PORT, 3100),
    secret: process.env.INTERNAL_API_SECRET!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  admin: {
    badgeAdminUserIds: parse_csv_env(process.env.BADGE_ADMIN_USER_IDS),
    fanArtReviewerUserIds: parse_csv_env(process.env.FAN_ART_REVIEWER_USER_IDS),
  },
} as const;

// Validação de variáveis obrigatórias
const requiredEnvVars = ['DISCORD_CLIENT_ID', 'DATABASE_URL', 'INTERNAL_API_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (!process.env.DISCORD_TOKEN && !process.env.DISCORD_BOT_TOKEN) {
  missingEnvVars.push('DISCORD_TOKEN (ou DISCORD_BOT_TOKEN)');
}

if (missingEnvVars.length > 0) {
  throw new Error(
    `Variáveis de ambiente faltando: ${missingEnvVars.join(', ')}\n` +
    `Por favor, configure o arquivo .env baseado no .env.example`
  );
}
