import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CONFIG } from './config';
import { prisma } from '@yuebot/database';
import authRoutes from './routes/auth';
import guildRoutes from './routes/guilds';
import giveawayRoutes from './routes/giveaways';
import xpRoutes from './routes/xp.routes';
import { statsRoutes } from './routes/stats.routes';
import { exportRoutes } from './routes/export.routes';
import { membersRoutes } from './routes/members.routes';
import { profileRoutes } from './routes/profile.routes'
import { badgesRoutes } from './routes/badges.routes'
import { fanartsRoutes } from './routes/fanarts.routes'
import { safe_error_details } from './utils/safe_error'

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

// Decorators para autenticação
app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
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

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).send({ error: 'Not found' });
});

app.setErrorHandler(async (error, request, reply) => {
  request.log.error({ err: safe_error_details(error) }, 'Unhandled error');

  const statusCode =
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  const message =
    statusCode >= 500
      ? 'Internal server error'
      : typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Bad request';

  return reply.code(statusCode).send({ error: message });
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Auth routes
app.register(authRoutes, { prefix: '/api/auth' });

// Guild routes
app.register(guildRoutes, { prefix: '/api/guilds' });

// XP routes
app.register(xpRoutes, { prefix: '/api/xp' });

// Giveaway routes
app.register(giveawayRoutes, { prefix: '/api/guilds' });

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
