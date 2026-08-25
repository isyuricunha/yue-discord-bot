import {
  load_env,
  parse_env_boolean,
  parse_env_csv,
  parse_env_port,
  parse_env_positive_int,
} from '@yuebot/shared/env';
import { parse_livepix_encryption_key } from '@yuebot/livepix';

const REQUIRED_RUNTIME_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'JWT_SECRET',
  'DATABASE_URL',
  'INTERNAL_API_SECRET',
] as const;


load_env();

const internal_api_port = parse_env_port(process.env.BOT_INTERNAL_PORT, 3100)
const internal_api_host = process.env.BOT_INTERNAL_API_HOST || process.env.BOT_INTERNAL_HOST || '127.0.0.1'

export const CONFIG = {
  api: {
    port: parse_env_port(process.env.API_PORT || process.env.PORT, 3000),
    host: process.env.API_HOST || '0.0.0.0',
    trustProxy: parse_env_boolean(process.env.TRUST_PROXY, process.env.NODE_ENV === 'production'),
    bodyLimit: parse_env_positive_int(process.env.API_BODY_LIMIT, 1024 * 1024, 50 * 1024 * 1024),
  },
  bot: {
    enabled: parse_env_boolean(process.env.ENABLE_BOT, true),
  },
  internalApi: {
    host: internal_api_host,
    port: internal_api_port,
    secret: process.env.INTERNAL_API_SECRET || '',
  },
  botReadiness: {
    host: process.env.BOT_READINESS_HOST || internal_api_host,
    port: parse_env_port(process.env.BOT_READINESS_PORT, internal_api_port + 1),
  },
  cors: {
    origins: parse_env_csv(process.env.CORS_ORIGINS),
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
    secure: parse_env_boolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  web: {
    url: process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  admin: {
    globalXpResetUserIds: parse_env_csv(process.env.GLOBAL_XP_RESET_USER_IDS),
    badgeAdminUserIds: parse_env_csv(process.env.BADGE_ADMIN_USER_IDS),
    fanArtReviewerUserIds: parse_env_csv(process.env.FAN_ART_REVIEWER_USER_IDS),
    ownerUserIds: parse_env_csv(process.env.OWNER_USER_IDS),
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  livePix: {
    enabled: parse_env_boolean(process.env.LIVEPIX_ENABLED, false),
    clientId: process.env.LIVEPIX_CLIENT_ID || '',
    clientSecret: process.env.LIVEPIX_CLIENT_SECRET || '',
    oauthRedirectUri: process.env.LIVEPIX_OAUTH_REDIRECT_URI || '',
    webhookUrl: process.env.LIVEPIX_WEBHOOK_URL || '',
    tokenEncryptionKey: process.env.LIVEPIX_TOKEN_ENCRYPTION_KEY || '',
    ownerGuildIds: parse_env_csv(process.env.LIVEPIX_OWNER_GUILD_IDS),
  },
  panelAi: {
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    mistralPanelAgentId: process.env.MISTRAL_PANEL_AGENT_ID || '',
    customProviderBaseUrl: process.env.CUSTOM_PROVIDER_BASE_URL || '',
    customProviderApiKey: process.env.CUSTOM_PROVIDER_API_KEY || '',
    promptPath: process.env.PANEL_AI_PROMPT_PATH || '',
    chatTimeoutMs: parse_env_positive_int(process.env.PANEL_AI_CHAT_TIMEOUT_MS, 90_000, 180_000),
    modelCatalogTimeoutMs: parse_env_positive_int(process.env.CUSTOM_PROVIDER_MODEL_LIST_TIMEOUT_MS, 300_000, 300_000),
  },
  rateLimit: {
    max: parse_env_positive_int(process.env.RATE_LIMIT_MAX, 100, 10_000),
    timeWindowMs: parse_env_positive_int(process.env.RATE_LIMIT_TIME_WINDOW, 60 * 1000, 60 * 60 * 1000),
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

  if (parse_env_boolean(env.LIVEPIX_ENABLED, false)) {
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
  const cookieSecure = parse_env_boolean(env.COOKIE_SECURE, env.NODE_ENV === 'production');
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
