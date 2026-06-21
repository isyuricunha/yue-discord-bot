import { load_env } from '@yuebot/shared';
import { parse_livepix_encryption_key } from '@yuebot/livepix';

const REQUIRED_RUNTIME_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'JWT_SECRET',
  'DATABASE_URL',
  'INTERNAL_API_SECRET',
] as const;

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
    host: process.env.BOT_INTERNAL_API_HOST || process.env.BOT_INTERNAL_HOST || '127.0.0.1',
    port: parse_int_env(process.env.BOT_INTERNAL_PORT, 3100),
    secret: process.env.INTERNAL_API_SECRET || '',
  },
  cors: {
    origins: parse_csv_env(process.env.CORS_ORIGINS),
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
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
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  livePix: {
    enabled: parse_boolean_env(process.env.LIVEPIX_ENABLED, false),
    clientId: process.env.LIVEPIX_CLIENT_ID || '',
    clientSecret: process.env.LIVEPIX_CLIENT_SECRET || '',
    oauthRedirectUri: process.env.LIVEPIX_OAUTH_REDIRECT_URI || '',
    webhookUrl: process.env.LIVEPIX_WEBHOOK_URL || '',
    tokenEncryptionKey: process.env.LIVEPIX_TOKEN_ENCRYPTION_KEY || '',
    ownerGuildIds: parse_csv_env(process.env.LIVEPIX_OWNER_GUILD_IDS),
  },
  rateLimit: {
    max: parse_int_env(process.env.RATE_LIMIT_MAX, 100),
    timeWindowMs: parse_int_env(process.env.RATE_LIMIT_TIME_WINDOW, 60 * 1000),
  },
  environment: process.env.NODE_ENV || 'development',
} as const;

export function get_api_runtime_env_errors(env: NodeJS.ProcessEnv): string[] {
  const errors: string[] = [];
  const missing = REQUIRED_RUNTIME_ENV_VARS.filter((key) => !env[key]);

  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (env.INTERNAL_API_SECRET && env.INTERNAL_API_SECRET.length < 32) {
    errors.push('INTERNAL_API_SECRET must be at least 32 characters long');
  }

  if (env.NODE_ENV === 'production') {
    if (!env.WEB_URL && !env.FRONTEND_URL) {
      errors.push('WEB_URL (or FRONTEND_URL) must be set in production');
    }

    if (!env.DISCORD_REDIRECT_URI) {
      errors.push('DISCORD_REDIRECT_URI must be set in production');
    }
  }

  if (parse_boolean_env(env.LIVEPIX_ENABLED, false)) {
    const livePixMissing = [
      'LIVEPIX_CLIENT_ID',
      'LIVEPIX_CLIENT_SECRET',
      'LIVEPIX_OAUTH_REDIRECT_URI',
      'LIVEPIX_WEBHOOK_URL',
      'LIVEPIX_TOKEN_ENCRYPTION_KEY',
    ].filter((key) => !env[key])

    if (livePixMissing.length > 0) {
      errors.push(`Missing required LivePix environment variables: ${livePixMissing.join(', ')}`)
    }

    if (env.LIVEPIX_TOKEN_ENCRYPTION_KEY) {
      try {
        parse_livepix_encryption_key(env.LIVEPIX_TOKEN_ENCRYPTION_KEY)
      } catch {
        errors.push('LIVEPIX_TOKEN_ENCRYPTION_KEY must decode to 32 bytes')
      }
    }
  }

  const cookieSameSite = env.COOKIE_SAMESITE || 'lax';
  const cookieSecure = parse_boolean_env(env.COOKIE_SECURE, env.NODE_ENV === 'production');
  if (cookieSameSite === 'none' && !cookieSecure) {
    errors.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }

  return errors;
}

export function assert_api_runtime_env(env: NodeJS.ProcessEnv = process.env): void {
  const errors = get_api_runtime_env_errors(env);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
