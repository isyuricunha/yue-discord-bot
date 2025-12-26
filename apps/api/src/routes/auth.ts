import type { FastifyInstance } from 'fastify';
import axios from 'axios';
import crypto from 'node:crypto';
import { CONFIG } from '../config';
import { is_owner } from '../utils/permissions';

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
  fastify.get('/login', async (_request, reply) => {
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
  fastify.get('/callback', async (request, reply) => {
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
            data: error.response?.data,
          },
          'Erro no OAuth callback (axios)'
        );

        return reply.code(500).send({ error: 'Authentication failed', details: error.message });
      }

      fastify.log.error(error as Error, 'Erro no OAuth callback');
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
      
      return { token: newToken };
    } catch (error: unknown) {
      fastify.log.error(error as Error);
      return reply.code(500).send({ error: 'Failed to refresh token' });
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    reply.clearCookie('yuebot_token', {
      path: '/',
      domain: CONFIG.cookies.domain,
    });
    return { success: true };
  });
}
