import { load_env } from '@yuebot/shared';

function parse_csv_env(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parse_boolean_env(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parse_int_env(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

load_env();

export const CONFIG = {
  api: {
    port: parseInt(process.env.API_PORT || process.env.PORT || '3000'),
    host: process.env.API_HOST || '0.0.0.0',
    trustProxy: parse_boolean_env(process.env.TRUST_PROXY, process.env.NODE_ENV === 'production'),
    bodyLimit: parse_int_env(process.env.API_BODY_LIMIT, 1024 * 1024),
  },
  internalApi: {
    host: process.env.BOT_INTERNAL_HOST || '127.0.0.1',
    port: parse_int_env(process.env.BOT_INTERNAL_PORT, 3100),
    secret: process.env.INTERNAL_API_SECRET!,
  },
  cors: {
    origins: parse_csv_env(process.env.CORS_ORIGINS),
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cookies: {
    sameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
    secure: parse_boolean_env(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  web: {
    url: process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  admin: {
    globalXpResetUserIds: parse_csv_env(process.env.GLOBAL_XP_RESET_USER_IDS),
    badgeAdminUserIds: parse_csv_env(process.env.BADGE_ADMIN_USER_IDS),
    fanArtReviewerUserIds: parse_csv_env(process.env.FAN_ART_REVIEWER_USER_IDS),
    ownerUserIds: parse_csv_env(process.env.OWNER_USER_IDS),
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  environment: process.env.NODE_ENV || 'development',
} as const;

if (CONFIG.environment === 'production') {
  const has_web_url = Boolean(process.env.WEB_URL || process.env.FRONTEND_URL)
  if (!has_web_url) {
    throw new Error('WEB_URL (or FRONTEND_URL) must be set in production')
  }

  if (!process.env.DISCORD_REDIRECT_URI) {
    throw new Error('DISCORD_REDIRECT_URI must be set in production')
  }
}

// Validação
const requiredVars = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'JWT_SECRET', 'DATABASE_URL', 'INTERNAL_API_SECRET'];
const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
}

if (CONFIG.jwt.secret.length < 32) {
  throw new Error('JWT_SECRET deve ter no mínimo 32 caracteres');
}

if (CONFIG.internalApi.secret.length < 32) {
  throw new Error('INTERNAL_API_SECRET deve ter no mínimo 32 caracteres');
}

if (CONFIG.cookies.sameSite === 'none' && !CONFIG.cookies.secure) {
  throw new Error('COOKIE_SAMESITE=none requer COOKIE_SECURE=true (exigência dos browsers)');
}
