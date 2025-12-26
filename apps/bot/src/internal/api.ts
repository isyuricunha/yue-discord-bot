import http from 'node:http';
import type { Client, GuildBasedChannel, GuildMember, Role } from 'discord.js';
import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';

type internal_api_options = {
  host: string;
  port: number;
  secret: string;
};

type api_error_body = {
  error: string;
};

type send_message_body = {
  content: string;
};

function send_json(reply: http.ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body);
  reply.statusCode = statusCode;
  reply.setHeader('content-type', 'application/json; charset=utf-8');
  reply.setHeader('content-length', Buffer.byteLength(payload));
  reply.end(payload);
}

function extract_path_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/(channels|roles|members)$/);
  if (!match) return null;
  return { guildId: match[1], resource: match[2] as 'channels' | 'roles' | 'members' };
}

function extract_send_message_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/channels\/([^/]+)\/messages$/);
  if (!match) return null;
  return { guildId: match[1], channelId: match[2] };
}

async function read_json_body(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  if (chunks.length === 0) return null;

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;

  return JSON.parse(raw) as unknown;
}

function pick_channel(channel: GuildBasedChannel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
  };
}

function pick_role(role: Role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    managed: role.managed,
  };
}

function pick_member(member: GuildMember) {
  return {
    userId: member.user.id,
    username: member.user.username,
    avatar: member.user.avatar,
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
  };
}

export function start_internal_api(client: Client, options: internal_api_options) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      const auth = req.headers.authorization;
      if (auth !== `Bearer ${options.secret}`) {
        return send_json(res, 401, { error: 'Unauthorized' } satisfies api_error_body);
      }

      if (url.pathname === '/internal/health') {
        return send_json(res, 200, { status: 'ok' });
      }

      if (req.method === 'POST') {
        const params = extract_send_message_params(url.pathname);
        if (!params) {
          return send_json(res, 404, { error: 'Not found' } satisfies api_error_body);
        }

        const body = await read_json_body(req).catch(() => null);
        const content =
          body && typeof (body as send_message_body).content === 'string'
            ? (body as send_message_body).content
            : '';

        if (!content.trim()) {
          return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body);
        }

        if (content.length > 2000) {
          return send_json(res, 400, { error: 'Message too long' } satisfies api_error_body);
        }

        const guild = await client.guilds.fetch(params.guildId).catch(() => null);
        if (!guild) {
          return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body);
        }

        const channel = await guild.channels.fetch(params.channelId).catch(() => null);
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
          return send_json(res, 404, { error: 'Channel not found' } satisfies api_error_body);
        }

        const sent = await channel.send({ content, allowedMentions: { parse: [] } });
        return send_json(res, 200, { messageId: sent.id });
      }

      if (req.method !== 'GET') {
        return send_json(res, 405, { error: 'Method not allowed' } satisfies api_error_body);
      }

      const params = extract_path_params(url.pathname);
      if (!params) {
        return send_json(res, 404, { error: 'Not found' } satisfies api_error_body);
      }

      const guild = await client.guilds.fetch(params.guildId).catch(() => null);
      if (!guild) {
        return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body);
      }

      if (params.resource === 'channels') {
        const channels = await guild.channels.fetch();
        const result = channels
          .filter((c): c is GuildBasedChannel => Boolean(c))
          .map(pick_channel);

        return send_json(res, 200, { channels: result });
      }

      if (params.resource === 'members') {
        const members = await guild.members.fetch();
        const result = members.map(pick_member);
        return send_json(res, 200, { members: result });
      }

      const roles = await guild.roles.fetch();
      const result = roles
        .filter((r): r is Role => Boolean(r))
        .sort((a, b) => b.position - a.position)
        .map(pick_role);

      return send_json(res, 200, { roles: result });
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Internal API error');
      return send_json(res, 500, { error: 'Internal server error' } satisfies api_error_body);
    }
  });

  server.listen(options.port, options.host, () => {
    logger.info(`🔒 Internal API listening on http://${options.host}:${options.port}`);
  });

  return server;
}
