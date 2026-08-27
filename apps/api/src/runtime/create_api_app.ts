import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CONFIG } from '../config';
import { request_guild_id, verify_live_guild_access } from '../utils/guild_access';
import { safe_error_details } from '../utils/safe_error';
import { get_readiness } from '../services/readiness.service';
import { registerApiRoutes } from './register_api_routes';

export type ApiAppResources = {
  app: FastifyInstance;
  redis_client?: Redis;
};

function rate_limit_error_payload(after_seconds: number) {
  const retry_after = Math.max(1, Math.ceil(after_seconds));
  return {
    error: 'Too many requests',
    message: `Rate limit exceeded. Try again in ${retry_after} seconds.`,
  };
}

export function createApiApp(): ApiAppResources {
  const app = Fastify({
    trustProxy: CONFIG.api.trustProxy,
    bodyLimit: CONFIG.api.bodyLimit,
    logger: {
      level: CONFIG.environment === 'development' ? 'info' : 'warn',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        remove: true,
      },
      transport: CONFIG.logFormat === 'pretty'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: Boolean(process.stdout.isTTY),
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname',
              messageFormat: '{msg}',
            },
          }
        : undefined,
    },
  });

  app.decorate('config', CONFIG);

  app.register(cookie);

  app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
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
      app.log.info('Rate limiting: Redis client created (will connect lazily)');
    } catch (error) {
      app.log.warn({ err: error }, 'Rate limiting: Failed to create Redis client, falling back to in-memory');
      redisClient = undefined;
    }
  }

  app.register(rateLimit, {
    redis: redisClient,
    max: CONFIG.rateLimit.max,
    timeWindow: CONFIG.rateLimit.timeWindowMs,
    errorResponseBuilder: (_request, context) => rate_limit_error_payload(context.ttl / 1000),
  });

  let authenticated_user_rate_limit: ReturnType<typeof app.createRateLimit> | undefined;

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (_error: unknown) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const user_id = typeof request.user.userId === 'string' ? request.user.userId.trim() : '';
    if (!user_id) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const check_user_rate_limit = authenticated_user_rate_limit ??= request.server.createRateLimit({
      max: CONFIG.rateLimit.max,
      timeWindow: CONFIG.rateLimit.timeWindowMs,
      keyGenerator: (rate_limit_request) => `user:${rate_limit_request.user.userId.trim()}`,
    });

    const user_limit = await check_user_rate_limit(request);
    if (!user_limit.isAllowed && user_limit.isExceeded) {
      reply.header('x-ratelimit-limit', user_limit.max);
      reply.header('x-ratelimit-remaining', 0);
      reply.header('x-ratelimit-reset', user_limit.ttlInSeconds);
      reply.header('retry-after', user_limit.ttlInSeconds);
      await reply.code(429).send(rate_limit_error_payload(user_limit.ttlInSeconds));
      return;
    }

    const guild_id = request_guild_id(request.params);
    if (!guild_id) return;

    try {
      const allowed = await verify_live_guild_access(request.user, guild_id, request.log);
      if (!allowed) {
        await reply.code(403).send({ error: 'Forbidden' });
        return;
      }
    } catch (error: unknown) {
      request.log.warn(
        {
          err: safe_error_details(error),
          guildId: guild_id,
          userId: request.user.userId,
        },
        'Failed to verify live guild authorization'
      );
      await reply.code(503).send({ error: 'Authorization unavailable' });
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    const method = request.method.toUpperCase();
    const is_state_changing = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (!is_state_changing) return;

    const auth_header = request.headers.authorization;
    const using_bearer = typeof auth_header === 'string' && auth_header.toLowerCase().startsWith('bearer ');

    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const has_auth_cookie = Boolean(cookies?.yuebot_token);

    if (!using_bearer && has_auth_cookie) {
      const origin = request.headers.origin;
      if (typeof origin !== 'string' || !origin.trim()) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const normalized = origin.replace(/\/$/, '');
      if (!allowedCorsOrigins.includes(normalized)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

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

  app.get('/health', {
    config: {
      rateLimit: false,
    },
  }, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/ready', {
    config: {
      rateLimit: false,
    },
  }, async (request, reply) => {
    const readiness = await get_readiness();

    if (readiness.status !== 'ready') {
      request.log.warn({ checks: readiness.checks }, 'Container readiness check failed');
      return reply.code(503).send(readiness);
    }

    return readiness;
  });

  registerApiRoutes(app);

  return { app, redis_client: redisClient };
}
