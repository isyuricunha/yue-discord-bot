import { CONFIG } from '../config';
import type { FastifyBaseLogger } from 'fastify';

export class InternalBotApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message)
    this.name = 'InternalBotApiError'
  }
}

type guild_channels_response = {
  channels: Array<{ id: string; name: string; type: number }>;
};

type guild_roles_response = {
  roles: Array<{ id: string; name: string; color: number; position: number; managed: boolean }>;
};

type guild_members_response = {
  members: Array<{ userId: string; username: string; avatar: string | null; joinedAt: string | null }>;
};

type guild_info_response = {
  guild: {
    id: string
    name: string
    icon: string | null
    ownerId: string
    systemChannelId: string | null
    rulesChannelId: string | null
    publicUpdatesChannelId: string | null
  }
}

type guild_counts_response = {
  approximateMemberCount: number
}

type send_message_response = {
  messageId: string;
};

type ticket_panel_publish_body = {
  moderatorId: string
  channelId: string
}

type ticket_panel_publish_response = {
  messageId: string
}

type reaction_role_panel_publish_body = {
  moderatorId: string
  channelId: string
}

type reaction_role_panel_publish_response = {
  messageId: string
}

type internal_commands_response = {
  slashCommands: Array<{ name: string; json: unknown }>
  contextMenuCommands: Array<{ name: string; json: unknown }>
}

type set_presence_body = {
  presenceEnabled: boolean
  presenceStatus: string
  activityType: string | null
  activityName: string | null
  activityUrl: string | null
}

type set_presence_response = {
  presence: {
    presenceEnabled: boolean
    presenceStatus: string
    activityType: string | null
    activityName: string | null
    activityUrl: string | null
  }
}

type set_profile_body = {
  userId: string
  bio: string | null
}

type set_profile_response = {
  success: true
  profile: {
    userId: string
    bio: string | null
  }
}

type set_app_description_body = {
  appDescription: string | null
}

type set_app_description_response = {
  success: true
  appDescription: string | null
}

type moderation_action = 'ban' | 'unban' | 'kick' | 'timeout' | 'untimeout'

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

type moderate_member_body = {
  moderatorId: string
  userId: string
  reason?: string
  duration?: string
  deleteMessageDays?: number
}

type moderate_member_response = {
  success: true
}

type cache_entry<T> = {
  value: T;
  expires_at: number;
};

type internal_cache_key = string;

type resource = 'channels' | 'roles' | 'members' | 'info' | 'counts' | 'is_admin';

type cache_state = {
  cache: Map<internal_cache_key, cache_entry<unknown>>;
  in_flight: Map<internal_cache_key, Promise<unknown>>;
};

const state: cache_state = {
  cache: new Map(),
  in_flight: new Map(),
};

function now_ms() {
  return Date.now();
}

function get_request_id(log: FastifyBaseLogger): string | null {
  const bindings = (log as unknown as { bindings?: () => Record<string, unknown> }).bindings
  if (typeof bindings !== 'function') return null

  const data = bindings()
  const req_id = data?.reqId
  return typeof req_id === 'string' && req_id.trim().length > 0 ? req_id : null
}

function build_internal_headers(
  log: FastifyBaseLogger,
  extra: Record<string, string> = {}
): Record<string, string> {
  const request_id = get_request_id(log)

  return {
    authorization: `Bearer ${CONFIG.internalApi.secret}`,
    ...(request_id ? { 'x-request-id': request_id } : {}),
    ...extra,
  }
}

async function fetch_with_timeout_ms(url: string, log: FastifyBaseLogger, timeout_ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeout_ms);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...build_internal_headers(log),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      log.warn({ status: res.status, url }, 'Internal bot API returned error');
      throw new InternalBotApiError(`Internal bot API returned ${res.status}`, res.status, body)
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

export async function get_internal_health(log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/health`
  return (await fetch_with_timeout_ms(url, log, 3_000)) as { status: string }
}

async function fetch_json_with_timeout_ms(
  url: string,
  log: FastifyBaseLogger,
  timeout_ms: number,
  init: RequestInit
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeout_ms);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...build_internal_headers(log, { 'content-type': 'application/json' }),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      log.warn({ status: res.status, url }, 'Internal bot API returned error');
      throw new InternalBotApiError(`Internal bot API returned ${res.status}`, res.status, body)
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function build_key(resource: resource, guild_id: string) {
  return `${resource}:${guild_id}`;
}

function build_admin_key(guild_id: string, user_id: string) {
  return `is_admin:${guild_id}:${user_id}`
}

function internal_cache_ttl_ms() {
  const env = process.env.INTERNAL_API_CACHE_TTL_MS;
  if (!env) return 20_000;

  const parsed = Number.parseInt(env, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 20_000;

  return parsed;
}

function prune_cache() {
  const now = now_ms();

  for (const [key, entry] of state.cache.entries()) {
    if (entry.expires_at <= now) {
      state.cache.delete(key);
    }
  }

  const max_entries_env = process.env.INTERNAL_API_CACHE_MAX_ENTRIES;
  const max_entries = max_entries_env ? Number.parseInt(max_entries_env, 10) : 500;

  if (!Number.isFinite(max_entries) || max_entries <= 0) return;

  while (state.cache.size > max_entries) {
    const first = state.cache.keys().next();
    if (first.done) break;
    state.cache.delete(first.value);
  }
}

async function fetch_with_timeout(url: string, log: FastifyBaseLogger) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...build_internal_headers(log),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn({ status: res.status, url }, 'Internal bot API returned error');
      throw new Error(`Internal bot API returned ${res.status}`);
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function get_cached<T>(key: internal_cache_key, load: () => Promise<T>) {
  prune_cache();

  const cached = state.cache.get(key);
  const now = now_ms();

  if (cached && cached.expires_at > now) {
    return cached.value as T;
  }

  const existing_in_flight = state.in_flight.get(key);
  if (existing_in_flight) {
    return (await existing_in_flight) as T;
  }

  const in_flight = load()
    .then((value) => {
      state.cache.set(key, {
        value,
        expires_at: now_ms() + internal_cache_ttl_ms(),
      });
      return value;
    })
    .finally(() => {
      state.in_flight.delete(key);
    });

  state.in_flight.set(key, in_flight);

  return (await in_flight) as T;
}

export async function get_guild_channels(guild_id: string, log: FastifyBaseLogger) {
  const key = build_key('channels', guild_id);

  return await get_cached<guild_channels_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/channels`;
    return (await fetch_with_timeout(url, log)) as guild_channels_response;
  });
}

export async function get_guild_info(guild_id: string, log: FastifyBaseLogger) {
  const key = build_key('info', guild_id)

  return await get_cached<guild_info_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/info`
    return (await fetch_with_timeout_ms(url, log, 8_000)) as guild_info_response
  })
}

export async function get_bot_permissions(guild_id: string, log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/permissions/bot`
  return (await fetch_with_timeout_ms(url, log, 8_000)) as bot_permissions_response
}

export async function get_bot_channel_permissions(guild_id: string, channel_id: string, log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/channels/${channel_id}/permissions/bot`
  return (await fetch_with_timeout_ms(url, log, 8_000)) as bot_channel_permissions_response
}

export async function get_guild_counts(guild_id: string, log: FastifyBaseLogger) {
  const key = build_key('counts', guild_id)

  return await get_cached<guild_counts_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/counts`
    return (await fetch_with_timeout_ms(url, log, 8_000)) as guild_counts_response
  })
}

export async function send_guild_message(
  guild_id: string,
  channel_id: string,
  content: string,
  log: FastifyBaseLogger
) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/channels/${channel_id}/messages`;
  return (await fetch_json_with_timeout_ms(url, log, 20_000, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })) as send_message_response;
}

export async function get_guild_roles(guild_id: string, log: FastifyBaseLogger) {
  const key = build_key('roles', guild_id);

  return await get_cached<guild_roles_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/roles`;
    return (await fetch_with_timeout(url, log)) as guild_roles_response;
  });
}

export async function get_guild_members(guild_id: string, log: FastifyBaseLogger) {
  const key = build_key('members', guild_id);

  return await get_cached<guild_members_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/members`;
    return (await fetch_with_timeout_ms(url, log, 20_000)) as guild_members_response;
  });
}

export async function is_guild_admin(guild_id: string, user_id: string, log: FastifyBaseLogger) {
  const key = build_admin_key(guild_id, user_id)

  return await get_cached<admin_check_response>(key, async () => {
    const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${guild_id}/permissions/admin/${user_id}`
    return (await fetch_with_timeout_ms(url, log, 8_000)) as admin_check_response
  })
}

export async function moderate_guild_member(
  input: {
    guildId: string
    action: moderation_action
    moderatorId: string
    userId: string
    reason?: string
    duration?: string
    deleteMessageDays?: number
  },
  log: FastifyBaseLogger
) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${input.guildId}/moderation/${input.action}`

  const body: moderate_member_body = {
    moderatorId: input.moderatorId,
    userId: input.userId,
    ...(typeof input.reason === 'string' ? { reason: input.reason } : {}),
    ...(typeof input.duration === 'string' ? { duration: input.duration } : {}),
    ...(typeof input.deleteMessageDays === 'number' ? { deleteMessageDays: input.deleteMessageDays } : {}),
  }

  return (await fetch_json_with_timeout_ms(url, log, 20_000, {
    method: 'POST',
    body: JSON.stringify(body),
  })) as moderate_member_response
}

export async function publish_ticket_panel(
  input: { guildId: string; channelId: string; moderatorId: string },
  log: FastifyBaseLogger
) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${input.guildId}/tickets/panel`

  const body: ticket_panel_publish_body = {
    moderatorId: input.moderatorId,
    channelId: input.channelId,
  }

  return (await fetch_json_with_timeout_ms(url, log, 20_000, {
    method: 'POST',
    body: JSON.stringify(body),
  })) as ticket_panel_publish_response
}

export async function publish_reaction_role_panel(
  input: { guildId: string; panelId: string; channelId: string; moderatorId: string },
  log: FastifyBaseLogger
) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/guilds/${input.guildId}/reaction-roles/panels/${input.panelId}/publish`

  const body: reaction_role_panel_publish_body = {
    moderatorId: input.moderatorId,
    channelId: input.channelId,
  }

  return (await fetch_json_with_timeout_ms(url, log, 20_000, {
    method: 'POST',
    body: JSON.stringify(body),
  })) as reaction_role_panel_publish_response
}

export async function get_bot_commands(log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/commands`
  return (await fetch_with_timeout_ms(url, log, 8_000)) as internal_commands_response
}

export async function set_bot_presence(input: set_presence_body, log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/presence`
  return (await fetch_json_with_timeout_ms(url, log, 8_000, {
    method: 'POST',
    body: JSON.stringify(input),
  })) as set_presence_response
}

export async function set_user_profile(input: set_profile_body, log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/profile`
  return (await fetch_json_with_timeout_ms(url, log, 8_000, {
    method: 'POST',
    body: JSON.stringify(input),
  })) as set_profile_response
}

export async function set_bot_app_description(input: set_app_description_body, log: FastifyBaseLogger) {
  const url = `http://${CONFIG.internalApi.host}:${CONFIG.internalApi.port}/internal/app-description`
  return (await fetch_json_with_timeout_ms(url, log, 8_000, {
    method: 'POST',
    body: JSON.stringify(input),
  })) as set_app_description_response
}
