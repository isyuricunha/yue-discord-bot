import http from 'node:http';
import { PermissionFlagsBits } from 'discord.js';
import type { Client, GuildBasedChannel, GuildMember, Role, User } from 'discord.js';
import { prisma } from '@yuebot/database';
import { CONFIG } from '../config';
import { moderationLogService } from '../services/moderationLog.service';
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

type moderation_action = 'ban' | 'unban' | 'kick' | 'timeout' | 'untimeout'

type moderation_body = {
  moderatorId: string
  userId: string
  reason?: string
  duration?: string
  deleteMessageDays?: number
}

type admin_check_response = {
  isAdmin: boolean
}

async function ensure_member_row(input: {
  guildId: string
  userId: string
  username: string
  avatar: string | null
  joinedAt: Date
}) {
  await prisma.guildMember.upsert({
    where: {
      userId_guildId: {
        userId: input.userId,
        guildId: input.guildId,
      },
    },
    update: {
      username: input.username,
      avatar: input.avatar,
    },
    create: {
      userId: input.userId,
      guildId: input.guildId,
      username: input.username,
      avatar: input.avatar,
      joinedAt: input.joinedAt,
    },
  })
}

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

function extract_moderation_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/moderation\/(ban|unban|kick|timeout|untimeout)$/)
  if (!match) return null
  return { guildId: match[1], action: match[2] as moderation_action }
}

function extract_admin_check_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/permissions\/admin\/([^/]+)$/)
  if (!match) return null
  return { guildId: match[1], userId: match[2] }
}

function parse_duration_ms(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) return null

  const value = Number.parseInt(match[1]!, 10)
  if (!Number.isFinite(value) || value <= 0) return null

  const unit = match[2]
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }

  const ms = value * (multipliers[unit!] ?? 0)
  if (!ms) return null

  const max = 28 * 24 * 60 * 60 * 1000
  return Math.min(ms, max)
}

function required_permission_for_action(action: moderation_action) {
  switch (action) {
    case 'ban':
    case 'unban':
      return PermissionFlagsBits.BanMembers
    case 'kick':
      return PermissionFlagsBits.KickMembers
    case 'timeout':
    case 'untimeout':
      return PermissionFlagsBits.ModerateMembers
  }
}

function is_valid_moderation_body(body: unknown): body is moderation_body {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.moderatorId !== 'string' || b.moderatorId.trim().length === 0) return false
  if (typeof b.userId !== 'string' || b.userId.trim().length === 0) return false
  if (b.reason !== undefined && typeof b.reason !== 'string') return false
  if (b.duration !== undefined && typeof b.duration !== 'string') return false
  if (b.deleteMessageDays !== undefined && typeof b.deleteMessageDays !== 'number') return false
  return true
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

      if (req.method === 'GET') {
        const admin_check = extract_admin_check_params(url.pathname)
        if (admin_check) {
          const guild = await client.guilds.fetch(admin_check.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const member = await guild.members.fetch(admin_check.userId).catch(() => null)
          const is_admin = Boolean(member?.permissions.has(PermissionFlagsBits.Administrator))
          return send_json(res, 200, { isAdmin: is_admin } satisfies admin_check_response)
        }
      }

      if (req.method === 'POST') {
        const message_params = extract_send_message_params(url.pathname);
        if (message_params) {
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

          const guild = await client.guilds.fetch(message_params.guildId).catch(() => null);
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body);
          }

          const channel = await guild.channels.fetch(message_params.channelId).catch(() => null);
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            return send_json(res, 404, { error: 'Channel not found' } satisfies api_error_body);
          }

          const sent = await channel.send({ content, allowedMentions: { parse: [] } });
          return send_json(res, 200, { messageId: sent.id });
        }

        const moderation_params = extract_moderation_params(url.pathname)
        if (moderation_params) {
          const body = await read_json_body(req).catch(() => null)
          if (!is_valid_moderation_body(body)) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          const is_owner_moderator = CONFIG.admin.ownerUserIds.includes(body.moderatorId)

          const guild = await client.guilds.fetch(moderation_params.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const required = required_permission_for_action(moderation_params.action)
          let moderator: GuildMember | null = null
          let staff_user: User | null = null
          let moderator_position: number | null = null

          if (!is_owner_moderator) {
            moderator = await guild.members.fetch(body.moderatorId).catch(() => null)
            if (!moderator) {
              return send_json(res, 404, { error: 'Moderator not found' } satisfies api_error_body)
            }

            if (!moderator.permissions.has(required)) {
              return send_json(res, 403, { error: 'Forbidden' } satisfies api_error_body)
            }

            staff_user = moderator.user
            moderator_position = moderator.roles.highest.position
          } else {
            staff_user = await client.users.fetch(body.moderatorId).catch(() => null)
            if (!staff_user) {
              return send_json(res, 404, { error: 'Moderator not found' } satisfies api_error_body)
            }
          }

          const me = await guild.members.fetchMe().catch(() => null)
          if (!me || !me.permissions.has(required)) {
            return send_json(res, 403, { error: 'Bot lacks permissions' } satisfies api_error_body)
          }

          if (body.userId === body.moderatorId) {
            return send_json(res, 400, { error: 'Cannot target self' } satisfies api_error_body)
          }

          if (client.user?.id && body.userId === client.user.id) {
            return send_json(res, 400, { error: 'Cannot target bot' } satisfies api_error_body)
          }

          const reason = typeof body.reason === 'string' && body.reason.trim().length > 0 ? body.reason.trim() : undefined
          const effective_reason = reason ?? 'Não especificada'

          const target_user = await client.users.fetch(body.userId).catch(() => null)
          if (!target_user) {
            return send_json(res, 404, { error: 'User not found' } satisfies api_error_body)
          }

          if (moderation_params.action === 'ban') {
            const target_member = await guild.members.fetch(body.userId).catch(() => null)
            if (target_member) {
              const target_position = target_member.roles.highest.position

              if (!is_owner_moderator && moderator_position !== null && target_position >= moderator_position) {
                return send_json(res, 403, { error: 'Target has higher or equal role' } satisfies api_error_body)
              }

              if (target_position >= (me?.roles.highest.position ?? 0)) {
                return send_json(res, 403, { error: 'Bot cannot moderate this target' } satisfies api_error_body)
              }
            }

            const days = typeof body.deleteMessageDays === 'number' ? body.deleteMessageDays : 0
            const clamped_days = Math.max(0, Math.min(7, Math.floor(days)))
            await guild.members.ban(body.userId, {
              reason: effective_reason,
              deleteMessageSeconds: clamped_days * 86_400,
            })

            await ensure_member_row({
              guildId: guild.id,
              userId: target_user.id,
              username: target_user.username,
              avatar: target_user.avatar,
              joinedAt: target_member?.joinedAt ?? new Date(),
            })

            await prisma.modLog.create({
              data: {
                guildId: guild.id,
                userId: target_user.id,
                moderatorId: body.moderatorId,
                action: 'ban',
                reason: effective_reason,
                metadata: { deleteMessageDays: clamped_days },
              },
            })

            await moderationLogService.notify({
              guild,
              user: target_user,
              staff: staff_user,
              punishment: 'ban',
              reason: effective_reason,
              duration: '',
            })

            return send_json(res, 200, { success: true })
          }

          if (moderation_params.action === 'unban') {
            await guild.bans.remove(body.userId, effective_reason)

            await ensure_member_row({
              guildId: guild.id,
              userId: target_user.id,
              username: target_user.username,
              avatar: target_user.avatar,
              joinedAt: new Date(),
            })

            await prisma.modLog.create({
              data: {
                guildId: guild.id,
                userId: target_user.id,
                moderatorId: body.moderatorId,
                action: 'unban',
                reason: effective_reason,
              },
            })

            await moderationLogService.notify({
              guild,
              user: target_user,
              staff: staff_user,
              punishment: 'unban',
              reason: effective_reason,
              duration: '',
            })

            return send_json(res, 200, { success: true })
          }

          if (moderation_params.action === 'kick') {
            const target_member = await guild.members.fetch(body.userId).catch(() => null)
            if (!target_member) {
              return send_json(res, 404, { error: 'Target not found' } satisfies api_error_body)
            }

            const target_position = target_member.roles.highest.position

            if (!is_owner_moderator && moderator_position !== null && target_position >= moderator_position) {
              return send_json(res, 403, { error: 'Target has higher or equal role' } satisfies api_error_body)
            }

            if (target_position >= (me?.roles.highest.position ?? 0)) {
              return send_json(res, 403, { error: 'Bot cannot moderate this target' } satisfies api_error_body)
            }

            await target_member.kick(effective_reason)

            await ensure_member_row({
              guildId: guild.id,
              userId: target_user.id,
              username: target_user.username,
              avatar: target_user.avatar,
              joinedAt: target_member.joinedAt ?? new Date(),
            })

            await prisma.modLog.create({
              data: {
                guildId: guild.id,
                userId: target_user.id,
                moderatorId: body.moderatorId,
                action: 'kick',
                reason: effective_reason,
              },
            })

            await moderationLogService.notify({
              guild,
              user: target_user,
              staff: staff_user,
              punishment: 'kick',
              reason: effective_reason,
              duration: '',
            })

            return send_json(res, 200, { success: true })
          }

          if (moderation_params.action === 'timeout') {
            const target_member = await guild.members.fetch(body.userId).catch(() => null)
            if (!target_member) {
              return send_json(res, 404, { error: 'Target not found' } satisfies api_error_body)
            }

            const duration = typeof body.duration === 'string' ? body.duration : ''
            const ms = duration ? parse_duration_ms(duration) : null
            if (!ms) {
              return send_json(res, 400, { error: 'Invalid duration' } satisfies api_error_body)
            }

            const target_position = target_member.roles.highest.position

            if (!is_owner_moderator && moderator_position !== null && target_position >= moderator_position) {
              return send_json(res, 403, { error: 'Target has higher or equal role' } satisfies api_error_body)
            }

            if (target_position >= (me?.roles.highest.position ?? 0)) {
              return send_json(res, 403, { error: 'Bot cannot moderate this target' } satisfies api_error_body)
            }

            await target_member.timeout(ms, effective_reason)

            await ensure_member_row({
              guildId: guild.id,
              userId: target_user.id,
              username: target_user.username,
              avatar: target_user.avatar,
              joinedAt: target_member.joinedAt ?? new Date(),
            })

            await prisma.modLog.create({
              data: {
                guildId: guild.id,
                userId: target_user.id,
                moderatorId: body.moderatorId,
                action: 'mute',
                reason: effective_reason,
                duration,
              },
            })

            await moderationLogService.notify({
              guild,
              user: target_user,
              staff: staff_user,
              punishment: 'mute',
              reason: effective_reason,
              duration,
            })

            return send_json(res, 200, { success: true })
          }

          // untimeout
          const target_member = await guild.members.fetch(body.userId).catch(() => null)
          if (!target_member) {
            return send_json(res, 404, { error: 'Target not found' } satisfies api_error_body)
          }

          const target_position = target_member.roles.highest.position

          if (!is_owner_moderator && moderator_position !== null && target_position >= moderator_position) {
            return send_json(res, 403, { error: 'Target has higher or equal role' } satisfies api_error_body)
          }

          if (target_position >= (me?.roles.highest.position ?? 0)) {
            return send_json(res, 403, { error: 'Bot cannot moderate this target' } satisfies api_error_body)
          }

          await target_member.timeout(null, effective_reason)

          await ensure_member_row({
            guildId: guild.id,
            userId: target_user.id,
            username: target_user.username,
            avatar: target_user.avatar,
            joinedAt: target_member.joinedAt ?? new Date(),
          })

          await prisma.modLog.create({
            data: {
              guildId: guild.id,
              userId: target_user.id,
              moderatorId: body.moderatorId,
              action: 'unmute',
              reason: effective_reason,
            },
          })

          await moderationLogService.notify({
            guild,
            user: target_user,
            staff: staff_user,
            punishment: 'unmute',
            reason: effective_reason,
            duration: '',
          })

          return send_json(res, 200, { success: true })
        }

        return send_json(res, 404, { error: 'Not found' } satisfies api_error_body);
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
