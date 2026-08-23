import type { FastifyInstance } from 'fastify';
import axios from 'axios';
import crypto from 'node:crypto';
import { CONFIG } from '../config';
import { is_owner } from '../utils/permissions';
import { safe_error_details } from '../utils/safe_error'
import { public_error_message } from '../utils/public_error'

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Login - Redireciona para Discord OAuth
  fastify.get('/login', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60_000,
      },
    },
  }, async (_request, reply) => {
    const state = crypto.randomBytes(16).toString('hex');

    reply.setCookie('oauth_state', state, {
      httpOnly: true,
      secure: CONFIG.cookies.secure,
      sameSite: 'lax',
      domain: CONFIG.cookies.domain,
      path: '/api/auth',
      maxAge: 60 * 10,
    });

    const params = new URLSearchParams({
      client_id: CONFIG.discord.clientId,
      redirect_uri: CONFIG.discord.redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });

    reply.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  // Callback - Recebe code do Discord
  fastify.get('/callback', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60_000,
      },
    },
  }, async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code) {
      fastify.log.error('Code não encontrado na query');
      return reply.code(400).send({ error: 'Missing code' });
    }

    const cookieState = (request.cookies as Record<string, string | undefined>)?.oauth_state;

    if (!state || !cookieState || state !== cookieState) {
      fastify.log.error('OAuth state inválido');
      return reply.code(400).send({ error: 'Invalid state' });
    }

    try {
      // Trocar code por access token
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: CONFIG.discord.clientId,
          client_secret: CONFIG.discord.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: CONFIG.discord.redirectUri,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token } = tokenResponse.data;

      // Buscar dados do usuário
      const userResponse = await axios.get<DiscordUser>('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const user = userResponse.data;

      // Buscar guilds do usuário
      const guildsResponse = await axios.get<DiscordGuild[]>('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      // Filtrar guilds onde o usuário é admin (permission & 0x8)
      const adminGuilds = guildsResponse.data
        .filter((guild) => (BigInt(guild.permissions) & BigInt(0x8)) === BigInt(0x8))
        .map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
        }));

      const owner = is_owner(user.id);

      // Gerar JWT
      const token = fastify.jwt.sign(
        {
          userId: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          guilds: adminGuilds.map(g => g.id),
          guildsData: adminGuilds,
          isOwner: owner,
        },
        { expiresIn: CONFIG.jwt.expiresIn }
      );

      reply.clearCookie('oauth_state', {
        path: '/api/auth',
        domain: CONFIG.cookies.domain,
      });

      reply.setCookie('yuebot_token', token, {
        httpOnly: true,
        secure: CONFIG.cookies.secure,
        sameSite: CONFIG.cookies.sameSite,
        domain: CONFIG.cookies.domain,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      fastify.log.info(`Redirecionando para: ${CONFIG.web.url}`);
      reply.redirect(CONFIG.web.url);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        fastify.log.error(
          {
            message: error.message,
            status: error.response?.status,
            code: error.code,
          },
          'Erro no OAuth callback (axios)'
        );

        const include_details = CONFIG.environment === 'development'
        return reply.code(500).send(include_details
          ? { error: 'Authentication failed', details: error.message }
          : { error: 'Authentication failed' });
      }

      fastify.log.error({ err: safe_error_details(error) }, 'Erro no OAuth callback');
      return reply.code(500).send({ error: 'Authentication failed' });
    }
  });

  // Verificar token
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    return request.user;
  });

  // Refresh token
  fastify.post('/refresh', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: 60_000,
      },
    },
  }, async (request, reply) => {
    try {
      const user = request.user;
      
      // Gerar novo token com mesmo payload
      const newToken = fastify.jwt.sign(
        {
          userId: user.userId,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          guilds: user.guilds,
          guildsData: user.guildsData,
          isOwner: user.isOwner,
        },
        { expiresIn: CONFIG.jwt.expiresIn }
      );

      reply.setCookie('yuebot_token', newToken, {
        httpOnly: true,
        secure: CONFIG.cookies.secure,
        sameSite: CONFIG.cookies.sameSite,
        domain: CONFIG.cookies.domain,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return { success: true }
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to refresh token');
      return reply.code(500).send({ error: public_error_message(fastify, 'Failed to refresh token') });
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: 60_000,
      },
    },
  }, async (_request, reply) => {
    reply.clearCookie('yuebot_token', {
      path: '/',
      domain: CONFIG.cookies.domain,
    });
    return { success: true };
  });

  // Set token cookie (for dev mode URL token handling)
  // This endpoint accepts a token from the web app and stores it in an httpOnly cookie
  // Only available in development mode for security
  fastify.post('/set-token-cookie', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60_000,
      },
    },
  }, async (request, reply) => {
    // Only allow this endpoint in development mode
    if (CONFIG.environment !== 'development') {
      return reply.code(403).send({ error: 'Not available in production' })
    }

    const { token } = request.body as { token?: unknown }
    if (typeof token !== 'string' || !token.trim()) {
      return reply.code(400).send({ error: 'Invalid token' })
    }

    // Verify the token is valid before setting cookie
    try {
      await fastify.jwt.verify(token)
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }

    reply.setCookie('yuebot_token', token, {
      httpOnly: true,
      secure: CONFIG.cookies.secure,
      sameSite: CONFIG.cookies.sameSite,
      domain: CONFIG.cookies.domain,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return { success: true }
  });
}
