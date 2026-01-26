import http from 'node:http';
import { PermissionFlagsBits } from 'discord.js';
import type { Client, GuildBasedChannel, GuildMember, Role, User, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { prisma } from '@yuebot/database';
import { discord_timeout_max_ms, parseDurationMs } from '@yuebot/shared'
import { CONFIG } from '../config';
import { moderationLogService } from '../services/moderationLog.service';
import { ticketService } from '../services/ticket.service';
import { reactionRoleService } from '../services/reactionRole.service'
import { apply_presence, normalize_presence_body } from '../services/presence.service'
import {
  apply_app_description,
  normalize_app_description_body,
  save_app_description_settings,
} from '../services/app_description.service'
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

type ticket_panel_publish_body = {
  moderatorId: string
  channelId: string
}

type reaction_role_panel_publish_body = {
  moderatorId: string
  channelId: string
}

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

type bot_permissions_response = {
  permissions: {
    viewAuditLog: boolean
    manageGuild: boolean
    manageRoles: boolean
    manageChannels: boolean
    manageMessages: boolean
    banMembers: boolean
    kickMembers: boolean
    moderateMembers: boolean
    sendMessages: boolean
    embedLinks: boolean
  }
}

type bot_channel_permissions_response = {
  permissions: {
    viewChannel: boolean
    sendMessages: boolean
    embedLinks: boolean
  }
}

type guild_counts_response = {
  approximateMemberCount: number
}

type internal_commands_response = {
  slashCommands: Array<{ name: string; json: RESTPostAPIApplicationCommandsJSONBody }>
  contextMenuCommands: Array<{ name: string; json: RESTPostAPIApplicationCommandsJSONBody }>
}

type presence_update_response = {
  presence: {
    presenceEnabled: boolean
    presenceStatus: string
    activityType: string | null
    activityName: string | null
    activityUrl: string | null
  }
}

type profile_sync_body = {
  userId: string
  bio: string | null
}

type profile_sync_response = {
  success: true
  profile: {
    userId: string
    bio: string | null
  }
}

type app_description_update_response = {
  success: true
  appDescription: string | null
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
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/(channels|roles|members|info)$/);
  if (!match) return null;
  return { guildId: match[1], resource: match[2] as 'channels' | 'roles' | 'members' | 'info' };
}

function extract_send_message_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/channels\/([^/]+)\/messages$/);
  if (!match) return null;
  return { guildId: match[1], channelId: match[2] };
}

function extract_ticket_panel_publish_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/tickets\/panel$/)
  if (!match) return null
  return { guildId: match[1] }
}

function extract_reaction_role_panel_publish_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/reaction-roles\/panels\/([^/]+)\/publish$/)
  if (!match) return null
  return { guildId: match[1], panelId: match[2] }
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

function extract_bot_permissions_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/permissions\/bot$/)
  if (!match) return null
  return { guildId: match[1] }
}

function extract_bot_channel_permissions_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/channels\/([^/]+)\/permissions\/bot$/)
  if (!match) return null
  return { guildId: match[1], channelId: match[2] }
}

function extract_guild_counts_params(pathname: string) {
  const match = pathname.match(/^\/internal\/guilds\/([^/]+)\/counts$/)
  if (!match) return null
  return { guildId: match[1] }
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

function is_valid_ticket_panel_publish_body(body: unknown): body is ticket_panel_publish_body {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.moderatorId !== 'string' || b.moderatorId.trim().length === 0) return false
  if (typeof b.channelId !== 'string' || b.channelId.trim().length === 0) return false
  return true
}

function is_valid_reaction_role_panel_publish_body(body: unknown): body is reaction_role_panel_publish_body {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.moderatorId !== 'string' || b.moderatorId.trim().length === 0) return false
  if (typeof b.channelId !== 'string' || b.channelId.trim().length === 0) return false
  return true
}

function normalize_profile_sync_body(body: unknown): profile_sync_body | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const user_id = typeof b.userId === 'string' ? b.userId.trim() : ''
  if (!user_id) return null

  const bio_raw = b.bio
  if (bio_raw === null || bio_raw === undefined) {
    return { userId: user_id, bio: null }
  }

  if (typeof bio_raw !== 'string') return null
  const bio = bio_raw.trim()
  if (bio.length === 0) return { userId: user_id, bio: null }
  if (bio.length > 300) return null

  return { userId: user_id, bio }
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

      if (req.method === 'GET' && url.pathname === '/internal/commands') {
        const slash = Array.from(client.commands.values())
          .map((cmd) => ({ name: cmd.data.name, json: cmd.data.toJSON() }))
          .sort((a, b) => a.name.localeCompare(b.name))

        const context = Array.from(client.contextMenuCommands.values())
          .map((cmd) => ({ name: cmd.data.name, json: cmd.data.toJSON() }))
          .sort((a, b) => a.name.localeCompare(b.name))

        return send_json(res, 200, {
          slashCommands: slash,
          contextMenuCommands: context,
        } satisfies internal_commands_response)
      }

      if (req.method === 'GET') {
        const bot_permissions = extract_bot_permissions_params(url.pathname)
        if (bot_permissions) {
          const guild = await client.guilds.fetch(bot_permissions.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const me = await guild.members.fetchMe().catch(() => null)
          if (!me) {
            return send_json(res, 404, { error: 'Bot not found' } satisfies api_error_body)
          }

          return send_json(res, 200, {
            permissions: {
              viewAuditLog: me.permissions.has(PermissionFlagsBits.ViewAuditLog),
              manageGuild: me.permissions.has(PermissionFlagsBits.ManageGuild),
              manageRoles: me.permissions.has(PermissionFlagsBits.ManageRoles),
              manageChannels: me.permissions.has(PermissionFlagsBits.ManageChannels),
              manageMessages: me.permissions.has(PermissionFlagsBits.ManageMessages),
              banMembers: me.permissions.has(PermissionFlagsBits.BanMembers),
              kickMembers: me.permissions.has(PermissionFlagsBits.KickMembers),
              moderateMembers: me.permissions.has(PermissionFlagsBits.ModerateMembers),
              sendMessages: me.permissions.has(PermissionFlagsBits.SendMessages),
              embedLinks: me.permissions.has(PermissionFlagsBits.EmbedLinks),
            },
          } satisfies bot_permissions_response)
        }

        const bot_channel_permissions = extract_bot_channel_permissions_params(url.pathname)
        if (bot_channel_permissions) {
          const guild = await client.guilds.fetch(bot_channel_permissions.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const channel = await guild.channels.fetch(bot_channel_permissions.channelId).catch(() => null)
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            return send_json(res, 404, { error: 'Channel not found' } satisfies api_error_body)
          }

          const me = await guild.members.fetchMe().catch(() => null)
          if (!me) {
            return send_json(res, 404, { error: 'Bot not found' } satisfies api_error_body)
          }

          const perms =
            'permissionsFor' in channel && typeof channel.permissionsFor === 'function'
              ? channel.permissionsFor(me)
              : null

          return send_json(res, 200, {
            permissions: {
              viewChannel: Boolean(perms?.has(PermissionFlagsBits.ViewChannel)),
              sendMessages: Boolean(perms?.has(PermissionFlagsBits.SendMessages)),
              embedLinks: Boolean(perms?.has(PermissionFlagsBits.EmbedLinks)),
            },
          } satisfies bot_channel_permissions_response)
        }

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

        const counts_check = extract_guild_counts_params(url.pathname)
        if (counts_check) {
          const guild = await client.guilds.fetch({ guild: counts_check.guildId, withCounts: true }).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const count = typeof guild.approximateMemberCount === 'number' ? guild.approximateMemberCount : 0
          return send_json(res, 200, { approximateMemberCount: count } satisfies guild_counts_response)
        }
      }

      if (req.method === 'POST') {
        if (url.pathname === '/internal/presence') {
          const body = await read_json_body(req).catch(() => null)
          const parsed = normalize_presence_body(body)
          if (!parsed) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          apply_presence(client, parsed)

          return send_json(res, 200, {
            presence: {
              presenceEnabled: parsed.presenceEnabled,
              presenceStatus: parsed.presenceStatus,
              activityType: parsed.activityType,
              activityName: parsed.activityName,
              activityUrl: parsed.activityUrl,
            },
          } satisfies presence_update_response)
        }

        if (url.pathname === '/internal/app-description') {
          const body = await read_json_body(req).catch(() => null)
          const parsed = normalize_app_description_body(body)
          if (!parsed) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          const saved = await save_app_description_settings(parsed)
          await apply_app_description(client, saved)

          return send_json(res, 200, {
            success: true,
            appDescription: saved.appDescription,
          } satisfies app_description_update_response)
        }

        if (url.pathname === '/internal/profile') {
          const body = await read_json_body(req).catch(() => null)
          const parsed = normalize_profile_sync_body(body)
          if (!parsed) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          await prisma.user.upsert({
            where: { id: parsed.userId },
            update: {},
            create: { id: parsed.userId },
          })

          const profile = await prisma.userProfile.upsert({
            where: { userId: parsed.userId },
            update: { bio: parsed.bio ?? null },
            create: { userId: parsed.userId, bio: parsed.bio ?? null },
            select: { userId: true, bio: true },
          })

          return send_json(res, 200, { success: true, profile } satisfies profile_sync_response)
        }

        const ticket_panel_params = extract_ticket_panel_publish_params(url.pathname)
        if (ticket_panel_params) {
          const body = await read_json_body(req).catch(() => null)
          if (!is_valid_ticket_panel_publish_body(body)) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          const guild = await client.guilds.fetch(ticket_panel_params.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const is_owner_moderator = CONFIG.admin.ownerUserIds.includes(body.moderatorId)
          if (!is_owner_moderator) {
            const moderator = await guild.members.fetch(body.moderatorId).catch(() => null)
            if (!moderator) {
              return send_json(res, 404, { error: 'Moderator not found' } satisfies api_error_body)
            }

            const can_manage =
              moderator.permissions.has(PermissionFlagsBits.ManageGuild) ||
              moderator.permissions.has(PermissionFlagsBits.Administrator)
            if (!can_manage) {
              return send_json(res, 403, { error: 'Forbidden' } satisfies api_error_body)
            }
          }

          const channel = await guild.channels.fetch(body.channelId).catch(() => null)
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            return send_json(res, 404, { error: 'Channel not found' } satisfies api_error_body)
          }

          const me = await guild.members.fetchMe().catch(() => null)
          if (!me) {
            return send_json(res, 403, { error: 'Bot lacks permissions' } satisfies api_error_body)
          }

          const perms =
            'permissionsFor' in channel &&
            typeof channel.permissionsFor === 'function'
              ? channel.permissionsFor(me)
              : null

          if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            return send_json(res, 403, { error: 'Bot lacks permissions' } satisfies api_error_body)
          }

          const current = await prisma.ticketConfig.findUnique({
            where: { guildId: guild.id },
            select: { panelMessageId: true },
          })

          const ensured = await ticketService.ensure_panel_message(guild, body.channelId, current?.panelMessageId ?? null)

          await prisma.ticketConfig.upsert({
            where: { guildId: guild.id },
            update: {
              panelChannelId: body.channelId,
              panelMessageId: ensured.messageId,
            },
            create: {
              guildId: guild.id,
              panelChannelId: body.channelId,
              panelMessageId: ensured.messageId,
            },
          })

          return send_json(res, 200, { messageId: ensured.messageId })
        }

        const rr_publish_params = extract_reaction_role_panel_publish_params(url.pathname)
        if (rr_publish_params) {
          const body = await read_json_body(req).catch(() => null)
          if (!is_valid_reaction_role_panel_publish_body(body)) {
            return send_json(res, 400, { error: 'Invalid body' } satisfies api_error_body)
          }

          const guild = await client.guilds.fetch(rr_publish_params.guildId).catch(() => null)
          if (!guild) {
            return send_json(res, 404, { error: 'Guild not found' } satisfies api_error_body)
          }

          const is_owner_moderator = CONFIG.admin.ownerUserIds.includes(body.moderatorId)
          if (!is_owner_moderator) {
            const moderator = await guild.members.fetch(body.moderatorId).catch(() => null)
            if (!moderator) {
              return send_json(res, 404, { error: 'Moderator not found' } satisfies api_error_body)
            }

            const can_manage =
              moderator.permissions.has(PermissionFlagsBits.ManageGuild) ||
              moderator.permissions.has(PermissionFlagsBits.Administrator)
            if (!can_manage) {
              return send_json(res, 403, { error: 'Forbidden' } satisfies api_error_body)
            }
          }

          const panel = await prisma.reactionRolePanel.findUnique({
            where: { id: rr_publish_params.panelId },
            select: { id: true, guildId: true, messageId: true },
          })

          if (!panel || panel.guildId !== guild.id) {
            return send_json(res, 404, { error: 'Panel not found' } satisfies api_error_body)
          }

          const channel = await guild.channels.fetch(body.channelId).catch(() => null)
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            return send_json(res, 404, { error: 'Channel not found' } satisfies api_error_body)
          }

          const me = await guild.members.fetchMe().catch(() => null)
          if (!me) {
            return send_json(res, 403, { error: 'Bot lacks permissions' } satisfies api_error_body)
          }

          const perms =
            'permissionsFor' in channel &&
            typeof channel.permissionsFor === 'function'
              ? channel.permissionsFor(me)
              : null

          if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            return send_json(res, 403, { error: 'Bot lacks permissions' } satisfies api_error_body)
          }

          const ensured = await reactionRoleService.ensure_panel_message(guild, panel.id, body.channelId, panel.messageId ?? null)

          await prisma.reactionRolePanel.update({
            where: { id: panel.id },
            data: {
              channelId: body.channelId,
              messageId: ensured.messageId,
            },
          })

          return send_json(res, 200, { messageId: ensured.messageId })
        }

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
            const ms = duration
              ? parseDurationMs(duration, { maxMs: discord_timeout_max_ms, clampToMax: false })
              : null
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

      if (params.resource === 'info') {
        return send_json(res, 200, {
          guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            ownerId: guild.ownerId,
            systemChannelId: guild.systemChannelId ?? null,
            rulesChannelId: guild.rulesChannelId ?? null,
            publicUpdatesChannelId: guild.publicUpdatesChannelId ?? null,
          },
        });
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
