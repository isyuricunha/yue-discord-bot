import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { assert_api_runtime_env, CONFIG } from './config';
import { prisma } from '@yuebot/database';
import authRoutes from './routes/auth';
import guildRoutes from './routes/guilds';
import giveawayRoutes from './routes/giveaways';
import giveawayEntryEditRoutes from './routes/giveawayEntryEdit'
import xpRoutes from './routes/xp.routes';
import { statsRoutes } from './routes/stats.routes';
import { exportRoutes } from './routes/export.routes';
import { membersRoutes } from './routes/members.routes';
import { profileRoutes } from './routes/profile.routes'
import { badgesRoutes } from './routes/badges.routes'
import { fanartsRoutes } from './routes/fanarts.routes'
import { economyRoutes } from './routes/economy.routes'
import { coinflipRoutes } from './routes/coinflip.routes'
import { ownerRoutes } from './routes/owner.routes'
import { panelAiOwnerRoutes } from './routes/panel_ai_owner.routes'
import { panelAiRoutes } from './routes/panel_ai.routes'
import { auditRoutes } from './routes/audit.routes'
import { triggersRoutes } from './routes/triggers.routes'
import { supportRoutes } from './routes/support.routes'
import { livePixRoutes } from './routes/livepix.routes'
import { request_guild_id, verify_live_guild_access } from './utils/guild_access'
import { safe_error_details } from './utils/safe_error'

assert_api_runtime_env();

const app = Fastify({
  trustProxy: CONFIG.api.trustProxy,
  bodyLimit: CONFIG.api.bodyLimit,
  logger: {
    level: CONFIG.environment === 'development' ? 'info' : 'warn',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
    transport: CONFIG.environment === 'development' 
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

app.decorate('config', CONFIG);

// Plugins
app.register(cookie);

app.register(helmet, {
  // This is a JSON API; enabling CSP here often causes more harm than good.
  contentSecurityPolicy: false,

  // Avoid cross-origin policy surprises for an API behind reverse proxies.
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,

  referrerPolicy: { policy: 'no-referrer' },

  // Enable HSTS only in production.
  // Note: HSTS is only effective over HTTPS.
  hsts: CONFIG.environment === 'production'
    ? { maxAge: 60 * 60 * 24 * 180 }
    : false,
});

const defaultCorsOrigins = CONFIG.environment === 'development'
  ? [CONFIG.web.url, 'http://localhost:5173']
  : [CONFIG.web.url];
const allowedCorsOrigins = (CONFIG.cors.origins.length > 0 ? CONFIG.cors.origins : defaultCorsOrigins)
  .map((origin) => origin.replace(/\/$/, ''));

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, '');
    cb(null, allowedCorsOrigins.includes(normalizedOrigin));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['authorization', 'content-type'],
  credentials: true,
});

app.register(jwt, {
  secret: CONFIG.jwt.secret,
  cookie: {
    cookieName: 'yuebot_token',
    signed: false,
  },
});

// Rate limiting with Redis backend for multi-instance support
const redisUrl = CONFIG.redis.url;
const hasRedis = redisUrl && redisUrl.trim().length > 0 && redisUrl !== 'redis://localhost:6379';

let redisClient: Redis | undefined;
if (hasRedis) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    // Don't test connection here - let the rate-limit plugin handle it lazily
    app.log.info('Rate limiting: Redis client created (will connect lazily)');
  } catch (error) {
    app.log.warn({ err: error }, 'Rate limiting: Failed to create Redis client, falling back to in-memory');
    redisClient = undefined;
  }
}

function rate_limit_error_payload(after_seconds: number) {
  const retry_after = Math.max(1, Math.ceil(after_seconds))
  return {
    error: 'Too many requests',
    message: `Rate limit exceeded. Try again in ${retry_after} seconds.`,
  }
}

app.register(rateLimit, {
  // Use Redis if available, otherwise in-memory.
  redis: redisClient,
  // The global limiter is intentionally IP-based. Authenticated requests get a
  // second, verified user bucket in the authenticate decorator below.
  max: CONFIG.rateLimit.max,
  timeWindow: CONFIG.rateLimit.timeWindowMs,
  errorResponseBuilder: (_request, context) => rate_limit_error_payload(context.ttl / 1000),
});

let authenticated_user_rate_limit: ReturnType<typeof app.createRateLimit> | undefined

// Authentication, verified per-user rate limiting, and live guild authorization
app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (_error: unknown) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const user_id = typeof request.user.userId === 'string' ? request.user.userId.trim() : ''
  if (!user_id) {
    await reply.code(401).send({ error: 'Unauthorized' })
    return
  }

  const check_user_rate_limit = authenticated_user_rate_limit ??= request.server.createRateLimit({
    max: CONFIG.rateLimit.max,
    timeWindow: CONFIG.rateLimit.timeWindowMs,
    keyGenerator: (rate_limit_request) => `user:${rate_limit_request.user.userId.trim()}`,
  })

  const user_limit = await check_user_rate_limit(request)
  if (!user_limit.isAllowed && user_limit.isExceeded) {
    reply.header('x-ratelimit-limit', user_limit.max)
    reply.header('x-ratelimit-remaining', 0)
    reply.header('x-ratelimit-reset', user_limit.ttlInSeconds)
    reply.header('retry-after', user_limit.ttlInSeconds)
    await reply.code(429).send(rate_limit_error_payload(user_limit.ttlInSeconds))
    return
  }

  const guild_id = request_guild_id(request.params)
  if (!guild_id) return

  try {
    const allowed = await verify_live_guild_access(request.user, guild_id, request.log)
    if (!allowed) {
      await reply.code(403).send({ error: 'Forbidden' })
      return
    }
  } catch (error: unknown) {
    request.log.warn(
      {
        err: safe_error_details(error),
        guildId: guild_id,
        userId: request.user.userId,
      },
      'Failed to verify live guild authorization'
    )
    await reply.code(503).send({ error: 'Authorization unavailable' })
    return
  }
});

app.addHook('onRequest', async (request, reply) => {
  const method = request.method.toUpperCase()
  const is_state_changing = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (!is_state_changing) return

  const auth_header = request.headers.authorization
  const using_bearer = typeof auth_header === 'string' && auth_header.toLowerCase().startsWith('bearer ')

  const cookies = request.cookies as Record<string, string | undefined> | undefined
  const has_auth_cookie = Boolean(cookies?.yuebot_token)

  // If the request is authenticated via cookie (no Bearer token), enforce Origin checks
  // to mitigate CSRF when COOKIE_SAMESITE=none.
  if (!using_bearer && has_auth_cookie) {
    const origin = request.headers.origin
    if (typeof origin !== 'string' || !origin.trim()) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const normalized = origin.replace(/\/$/, '')
    if (!allowedCorsOrigins.includes(normalized)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
  }
})

app.addHook('onSend', async (request, reply, payload) => {
  reply.header('x-request-id', request.id)
  return payload
})

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).send({ error: 'Not found' });
});

app.setErrorHandler(async (error, request, reply) => {
  request.log.error({ err: safe_error_details(error) }, 'Unhandled error');

  const statusCode =
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  const is_development = CONFIG.environment === 'development';
  const is_client_error = statusCode < 500;
  const should_expose_details = is_development && (is_client_error || statusCode === 500);

  // In development: expose full error details
  // In production: only expose generic error messages without implementation details
  if (should_expose_details) {
    const errorMessage = typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : 'Unknown error';

    const errorCode = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

    const response: Record<string, unknown> = {
      error: errorMessage,
      statusCode,
    };

    if (errorCode) {
      response.code = errorCode;
    }

    return reply.code(statusCode).send(response);
  }

  // Production: generic error messages only
  const default_message_by_status: Record<number, string> = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    429: 'Too many requests',
    500: 'Internal server error',
  };

  const message = default_message_by_status[statusCode] ?? 'Bad request';
  return reply.code(statusCode).send({ error: message });
});

// Health check
app.get('/health', {
  config: {
    rateLimit: false,
  },
}, async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Auth routes
app.register(authRoutes, { prefix: '/api/auth' });

// Guild routes
app.register(guildRoutes, { prefix: '/api/guilds' });
app.register(supportRoutes, { prefix: '/api/guilds' });

// XP routes
app.register(xpRoutes, { prefix: '/api/xp' });

// Giveaway routes
app.register(giveawayRoutes, { prefix: '/api/guilds' });

// Public giveaway entry edit routes (token-based)
app.register(giveawayEntryEditRoutes, { prefix: '/api' })

// Stats routes
app.register(statsRoutes, { prefix: '/api' });

// Export routes
app.register(exportRoutes, { prefix: '/api' });

// Members routes
app.register(membersRoutes, { prefix: '/api' });

// Profile/Badges routes
app.register(profileRoutes, { prefix: '/api' })
app.register(badgesRoutes, { prefix: '/api' })

// Fan arts routes
app.register(fanartsRoutes, { prefix: '/api' })

// Economy/Coinflip routes
app.register(economyRoutes, { prefix: '/api' })
app.register(coinflipRoutes, { prefix: '/api' })

// Audit routes
app.register(auditRoutes, { prefix: '/api' })

// Triggers routes
app.register(triggersRoutes, { prefix: '/api/guilds' })

// Owner routes
app.register(ownerRoutes, { prefix: '/api' })
app.register(panelAiOwnerRoutes, { prefix: '/api' })
app.register(panelAiRoutes, { prefix: '/api' })

// LivePix public callback, return and webhook routes
app.register(livePixRoutes, { prefix: '/api' })

// Start server
const start = async () => {
  try {
    await app.listen({ port: CONFIG.api.port, host: CONFIG.api.host });
    app.log.info(`🚀 API rodando em http://${CONFIG.api.host}:${CONFIG.api.port}`);
    
    // Log registered routes
    if (CONFIG.environment === 'development') {
      app.log.info('📝 Rotas registradas:');
      app.log.info(app.printRoutes());
    }
  } catch (err: unknown) {
    app.log.error({ err: safe_error_details(err) }, 'Failed to start API');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  app.log.info('🛑 Desligando API...');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  app.log.info('🛑 Desligando API...');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();

export { app };
