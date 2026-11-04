import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordAPIError, PermissionFlagsBits } from 'discord.js';
import type { ButtonInteraction, Message } from 'discord.js';

import { prisma } from '@yuebot/database';
import { honeypotService } from './honeypot.service';
import { HONEYPOT_UNBAN_BUTTON_PREFIX } from './honeypot.rules';

const STAFF_FLAGS = [PermissionFlagsBits.BanMembers];
const MUTE_ONLY_FLAGS = [PermissionFlagsBits.ModerateMembers];

function patch_delegate(target: object, name: string, replacement: unknown): () => void {
  const record = target as Record<string, unknown>;
  const original = record[name];
  record[name] = replacement;
  return () => {
    record[name] = original;
  };
}

function mod_log_action(entry: Record<string, unknown> | undefined): string | undefined {
  return (entry?.data as { action?: string } | undefined)?.action;
}

interface fetched_member {
  permissions: { has(flag: bigint): boolean };
}

interface trap_guild {
  id: string;
  members: {
    ban: (userId: string, banOptions: unknown) => Promise<void>;
    fetch: (userId: string) => Promise<fetched_member | null>;
  };
  channels: {
    fetch: (channelId: string) => Promise<unknown>;
  };
}

interface create_message_options {
  guildId: string;
  channelId: string;
  authorId?: string;
  isClientAuthor?: boolean;
  isWebhook?: boolean;
  content?: string;
  banError?: Error;
  fetchedMember?: fetched_member | null;
  thread?: boolean;
}

interface create_message_state {
  message: Message;
  banCalls: Array<{ userId: string; options: unknown }>;
  deleteCalls: number[];
  logSends: unknown[];
  guild: trap_guild;
}

function create_trap_guild(options: {
  guildId: string;
  banError?: Error;
  fetchedMember?: fetched_member | null;
  banCalls: Array<{ userId: string; options: unknown }>;
  logSends: unknown[];
}): trap_guild {
  return {
    id: options.guildId,
    members: {
      ban: async (userId: string, banOptions: unknown) => {
        if (options.banError) throw options.banError;
        options.banCalls.push({ userId, options: banOptions });
      },
      fetch: async () => options.fetchedMember ?? null,
    },
    channels: {
      fetch: async (channelId: string) => {
        if (channelId !== 'log-1') return null;
        return {
          isTextBased: () => true,
          send: async (payload: unknown) => {
            options.logSends.push(payload);
          },
        };
      },
    },
  };
}

function create_message(options: create_message_options): create_message_state {
  const banCalls: Array<{ userId: string; options: unknown }> = [];
  const deleteCalls: number[] = [];
  const logSends: unknown[] = [];

  const author = {
    id: options.isClientAuthor ? 'client-1' : (options.authorId ?? 'user-1'),
    username: 'spammer',
    tag: 'spammer#0001',
    bot: options.isClientAuthor ?? false,
    createdTimestamp: Date.now() - 30 * 86_400_000,
    displayAvatarURL: () => 'https://cdn.example.test/avatar.png',
  };

  const guild = create_trap_guild({
    guildId: options.guildId,
    banError: options.banError,
    fetchedMember: options.fetchedMember,
    banCalls,
    logSends,
  });

  const message = {
    guild,
    author,
    client: { user: { id: 'client-1' } },
    channelId: options.channelId,
    channel: {
      id: options.channelId,
      isThread: () => options.thread ?? false,
      parentId: options.thread ? 'trap-1' : null,
    },
    webhookId: options.isWebhook ? 'webhook-1' : null,
    member: null,
    content: options.content ?? 'check my free crypto casino',
    delete: async () => {
      deleteCalls.push(1);
    },
  } as unknown as Message;

  return { message, banCalls, deleteCalls, logSends, guild };
}

function patch_honeypot_prisma(guildId: string, trapChannelId: string | null) {
  const modLogCreates: Array<Record<string, unknown>> = [];
  const memberUpserts: Array<Record<string, unknown>> = [];
  const guildConfigFindUnique = patch_delegate(
    prisma.guildConfig,
    'findUnique',
    async () => ({ modLogChannelId: 'log-1' }),
  );
  const honeyPotFindUnique = patch_delegate(
    prisma.guildHoneyPotConfig,
    'findUnique',
    async () => ({ guildId, channelId: trapChannelId }),
  );
  const memberUpsert = patch_delegate(prisma.guildMember, 'upsert', async (args: unknown) => {
    memberUpserts.push(args as Record<string, unknown>);
    return undefined;
  });
  const modLogCreate = patch_delegate(prisma.modLog, 'create', async (args: unknown) => {
    modLogCreates.push(args as Record<string, unknown>);
    return undefined;
  });

  return {
    modLogCreates,
    memberUpserts,
    restore: () => {
      guildConfigFindUnique();
      honeyPotFindUnique();
      memberUpsert();
      modLogCreate();
    },
  };
}

test('honeypot service', async (t) => {
  t.after(() => {
    honeypotService.clear_cache('guild-hp-1');
    honeypotService.clear_cache('guild-hp-2');
    honeypotService.clear_cache('guild-hp-dedup');
    honeypotService.clear_cache('guild-hp-left');
    honeypotService.clear_cache('guild-hp-thread');
    honeypotService.clear_cache('guild-hp-emoji');
    honeypotService.clear_cache('guild-hp-faildedup');
    honeypotService.clear_cache('guild-hp-staff');
    honeypotService.clear_cache('guild-hp-staffburst');
    honeypotService.clear_cache('guild-hp-transient');
    honeypotService.clear_cache('guild-hp-10007');
  });

  await t.test('bans a regular member posting in the trap channel and logs it', async () => {
    const state = create_message({ guildId: 'guild-hp-1', channelId: 'trap-1' });
    const prisma_state = patch_honeypot_prisma('guild-hp-1', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, true);
      assert.equal(state.banCalls.length, 1);
      assert.equal(state.banCalls[0]?.userId, 'user-1');
      assert.deepEqual(state.banCalls[0]?.options, {
        deleteMessageSeconds: 600,
        reason: '[HoneyPot] Message posted in the trap channel',
      });
      assert.equal(prisma_state.modLogCreates.length, 1);
      assert.equal(mod_log_action(prisma_state.modLogCreates[0]), 'honeypot_ban');
      assert.equal(state.logSends.length, 1);
      assert.equal(state.deleteCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('on failed ban: deletes the trap message, skips the audit row and reports the failure', async () => {
    const state = create_message({
      guildId: 'guild-hp-1',
      channelId: 'trap-1',
      authorId: 'user-2',
      banError: new Error('missing permissions'),
    });
    const prisma_state = patch_honeypot_prisma('guild-hp-1', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, true);
      assert.equal(state.banCalls.length, 0);
      assert.equal(state.deleteCalls.length, 1);
      // The audit table must not claim a ban that never happened.
      assert.equal(prisma_state.modLogCreates.length, 0);
      assert.equal(state.logSends.length, 1);
      const payload = state.logSends[0] as { components?: unknown };
      // Failure entries carry no Unban button: there is no ban to revert.
      assert.equal(payload.components, undefined);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('spares staff members resolved server-side even without message.member', async () => {
    const state = create_message({
      guildId: 'guild-hp-staff',
      channelId: 'trap-1',
      fetchedMember: { permissions: { has: (flag: bigint) => STAFF_FLAGS.includes(flag) } },
    });
    const prisma_state = patch_honeypot_prisma('guild-hp-staff', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, false);
      assert.equal(state.banCalls.length, 0);
      assert.equal(state.deleteCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('still catches accounts that left the guild (member lookup fails)', async () => {
    const state = create_message({ guildId: 'guild-hp-left', channelId: 'trap-1', fetchedMember: null });
    const prisma_state = patch_honeypot_prisma('guild-hp-left', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, true);
      assert.equal(state.banCalls.length, 1);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('catches thread messages spawned inside the trap channel', async () => {
    const state = create_message({ guildId: 'guild-hp-thread', channelId: 'thread-1', thread: true });
    const prisma_state = patch_honeypot_prisma('guild-hp-thread', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, true);
      assert.equal(state.banCalls.length, 1);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('swallows a spam burst as a single punishment', async () => {
    const first = create_message({ guildId: 'guild-hp-dedup', channelId: 'trap-1' });
    const second = create_message({ guildId: 'guild-hp-dedup', channelId: 'trap-1', authorId: 'user-1' });
    const shared_guild = first.guild;
    (second.message as unknown as { guild: trap_guild }).guild = shared_guild;
    const prisma_state = patch_honeypot_prisma('guild-hp-dedup', 'trap-1');

    try {
      const results = await Promise.all([
        honeypotService.handle_message(first.message),
        honeypotService.handle_message(second.message),
      ]);
      assert.deepEqual(results, [true, true]);
      assert.equal(first.banCalls.length + second.banCalls.length, 1);
      assert.equal(prisma_state.modLogCreates.length, 1);

      const third = create_message({ guildId: 'guild-hp-dedup', channelId: 'trap-1', authorId: 'user-1' });
      (third.message as unknown as { guild: trap_guild }).guild = shared_guild;
      await honeypotService.handle_message(third.message);
      assert.equal(first.banCalls.length + second.banCalls.length + third.banCalls.length, 1);
      assert.equal(prisma_state.modLogCreates.length, 1);
      // The follow-up message is still removed from the trap channel.
      assert.equal(third.deleteCalls.length, 1);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('after a failed ban, follow-up messages are deleted without duplicate failure embeds', async () => {
    const shared_error = new Error('missing permissions');
    const first = create_message({
      guildId: 'guild-hp-faildedup',
      channelId: 'trap-1',
      banError: shared_error,
    });
    const second = create_message({
      guildId: 'guild-hp-faildedup',
      channelId: 'trap-1',
      banError: shared_error,
    });
    (second.message as unknown as { guild: trap_guild }).guild = first.guild;
    const prisma_state = patch_honeypot_prisma('guild-hp-faildedup', 'trap-1');

    try {
      assert.equal(await honeypotService.handle_message(first.message), true);
      assert.equal(first.deleteCalls.length, 1);
      assert.equal(first.logSends.length, 1);

      assert.equal(await honeypotService.handle_message(second.message), true);
      // The payload is still removed, but no new failure embed or audit row.
      assert.equal(second.deleteCalls.length, 1);
      assert.equal(first.logSends.length, 1);
      assert.equal(prisma_state.modLogCreates.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('staff member burst: follow-up messages are neither deleted nor recorded', async () => {
    const staff_member: fetched_member = {
      permissions: { has: (flag: bigint) => STAFF_FLAGS.includes(flag) },
    };
    const first = create_message({ guildId: 'guild-hp-staffburst', channelId: 'trap-1', fetchedMember: staff_member });
    const second = create_message({ guildId: 'guild-hp-staffburst', channelId: 'trap-1', fetchedMember: staff_member });
    (second.message as unknown as { guild: trap_guild }).guild = first.guild;
    const prisma_state = patch_honeypot_prisma('guild-hp-staffburst', 'trap-1');

    try {
      const results = await Promise.all([
        honeypotService.handle_message(first.message),
        honeypotService.handle_message(second.message),
      ]);
      assert.deepEqual(results, [false, false]);
      assert.equal(first.banCalls.length + second.banCalls.length, 0);
      // Staff messages are never deleted by the dedup paths.
      assert.equal(first.deleteCalls.length + second.deleteCalls.length, 0);
      assert.equal(prisma_state.modLogCreates.length, 0);

      // A later staff message is still exempt (staff keys never enter the dedup map).
      const third = create_message({ guildId: 'guild-hp-staffburst', channelId: 'trap-1', fetchedMember: staff_member });
      (third.message as unknown as { guild: trap_guild }).guild = first.guild;
      assert.equal(await honeypotService.handle_message(third.message), false);
      assert.equal(third.deleteCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('left-guild lookup (DiscordAPIError 10007) still bans', async () => {
    const state = create_message({ guildId: 'guild-hp-10007', channelId: 'trap-1' });
    const banCalls: Array<{ userId: string; options: unknown }> = [];
    const logSends: unknown[] = [];
    const unknown_guild = create_trap_guild({ guildId: 'guild-hp-10007', banCalls, logSends, fetchedMember: null });
    (unknown_guild.members as unknown as { fetch: () => Promise<never> }).fetch = async () => {
      throw new DiscordAPIError(
        { code: 10007, message: 'Unknown Member' },
        10007,
        404,
        'GET',
        'https://discord.com/api/v10/guilds/g/members/u',
        { body: undefined, files: [] },
      );
    };
    (state.message as unknown as { guild: trap_guild }).guild = unknown_guild;
    const prisma_state = patch_honeypot_prisma('guild-hp-10007', 'trap-1');

    try {
      assert.equal(await honeypotService.handle_message(state.message), true);
      assert.equal(banCalls.length, 1);
      assert.equal(prisma_state.modLogCreates.length, 1);
      assert.equal(state.deleteCalls.length, 0);
      assert.equal(logSends.length, 1);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('transient member lookup failure fails closed: no ban, payload removed, failure reported', async () => {
    const state = create_message({ guildId: 'guild-hp-transient', channelId: 'trap-1' });
    const banCalls: Array<{ userId: string; options: unknown }> = [];
    const logSends: unknown[] = [];
    const failing_guild = create_trap_guild({ guildId: 'guild-hp-transient', banCalls, logSends, fetchedMember: null });
    (failing_guild.members as unknown as { fetch: () => Promise<never> }).fetch = async () => {
      throw new Error('rate limited');
    };
    (state.message as unknown as { guild: trap_guild }).guild = failing_guild;
    const prisma_state = patch_honeypot_prisma('guild-hp-transient', 'trap-1');

    try {
      assert.equal(await honeypotService.handle_message(state.message), true);
      assert.equal(banCalls.length, 0);
      assert.equal(state.deleteCalls.length, 1);
      assert.equal(logSends.length, 1);
      const payload = logSends[0] as { components?: unknown };
      assert.equal(payload.components, undefined);
      assert.equal(prisma_state.modLogCreates.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('ignores messages outside the trap channel', async () => {
    const state = create_message({ guildId: 'guild-hp-1', channelId: 'general-1' });
    const prisma_state = patch_honeypot_prisma('guild-hp-1', 'trap-1');

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, false);
      assert.equal(state.banCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('ignores webhooks and the bot itself', async () => {
    const webhook_message = create_message({ guildId: 'guild-hp-1', channelId: 'trap-1', isWebhook: true });
    const client_message = create_message({ guildId: 'guild-hp-1', channelId: 'trap-1', isClientAuthor: true });
    const prisma_state = patch_honeypot_prisma('guild-hp-1', 'trap-1');

    try {
      assert.equal(await honeypotService.handle_message(webhook_message.message), false);
      assert.equal(await honeypotService.handle_message(client_message.message), false);
      assert.equal(webhook_message.banCalls.length + client_message.banCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('does nothing when the guild has no trap channel configured', async () => {
    const state = create_message({ guildId: 'guild-hp-2', channelId: 'trap-1' });
    const prisma_state = patch_honeypot_prisma('guild-hp-2', null);

    try {
      const handled = await honeypotService.handle_message(state.message);
      assert.equal(handled, false);
      assert.equal(state.banCalls.length, 0);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('truncates emoji-heavy content without splitting surrogate pairs', async () => {
    const content = '🎉'.repeat(260);
    const state = create_message({ guildId: 'guild-hp-emoji', channelId: 'trap-1', content });
    const prisma_state = patch_honeypot_prisma('guild-hp-emoji', 'trap-1');

    try {
      await honeypotService.handle_message(state.message);
      assert.equal(state.logSends.length, 1);
      const payload = state.logSends[0] as { embeds: Array<{ data: { fields?: Array<{ value: string }> } }> };
      const preview = payload.embeds[0]?.data.fields?.[2]?.value;
      assert.equal(preview, content);
    } finally {
      prisma_state.restore();
    }
  });

  await t.test('unban button unbans the user and disables the button', async () => {
    const unbans: Array<{ userId: string; reason: string }> = [];
    const updates: unknown[] = [];
    const followUps: unknown[] = [];
    const modLogCreates: Array<Record<string, unknown>> = [];
    const modLogCreate = patch_delegate(prisma.modLog, 'create', async (args: unknown) => {
      modLogCreates.push(args as Record<string, unknown>);
      return undefined;
    });

    const interaction = {
      customId: `${HONEYPOT_UNBAN_BUTTON_PREFIX}100000000000000000`,
      guild: {
        id: 'guild-hp-1',
        members: {
          unban: async (userId: string, reason: string) => {
            unbans.push({ userId, reason });
          },
        },
      },
      member: { permissions: { has: (flag: bigint) => STAFF_FLAGS.includes(flag) } },
      user: { id: 'staff-1', tag: 'staff#0001' },
      message: { components: [] },
      update: async (payload: unknown) => {
        updates.push(payload);
      },
      followUp: async (payload: unknown) => {
        followUps.push(payload);
      },
      reply: async (payload: unknown) => {
        followUps.push(payload);
      },
    } as unknown as ButtonInteraction;

    try {
      await honeypotService.handle_unban_button(interaction);
      assert.equal(unbans.length, 1);
      assert.equal(unbans[0]?.userId, '100000000000000000');
      assert.equal(modLogCreates.length, 1);
      assert.equal(mod_log_action(modLogCreates[0]), 'honeypot_unban');
      assert.equal(updates.length, 1);
      assert.equal(followUps.length, 1);
    } finally {
      modLogCreate();
    }
  });

  await t.test('unban button rejects members without any staff permission', async () => {
    const unbans: unknown[] = [];
    const replies: unknown[] = [];

    const interaction = {
      customId: `${HONEYPOT_UNBAN_BUTTON_PREFIX}100000000000000000`,
      guild: {
        id: 'guild-hp-1',
        members: {
          unban: async (userId: string) => {
            unbans.push(userId);
          },
        },
      },
      member: { permissions: { has: () => false } },
      user: { id: 'member-1', tag: 'member#0001' },
      message: { components: [] },
      update: async () => undefined,
      followUp: async () => undefined,
      reply: async (payload: unknown) => {
        replies.push(payload);
      },
    } as unknown as ButtonInteraction;

    await honeypotService.handle_unban_button(interaction);
    assert.equal(unbans.length, 0);
    assert.equal(replies.length, 1);
  });

  await t.test('unban button rejects mute-only moderators', async () => {
    const unbans: unknown[] = [];
    const replies: unknown[] = [];

    const interaction = {
      customId: `${HONEYPOT_UNBAN_BUTTON_PREFIX}100000000000000000`,
      guild: {
        id: 'guild-hp-1',
        members: {
          unban: async (userId: string) => {
            unbans.push(userId);
          },
        },
      },
      member: { permissions: { has: (flag: bigint) => MUTE_ONLY_FLAGS.includes(flag) } },
      user: { id: 'mod-1', tag: 'mod#0001' },
      message: { components: [] },
      update: async () => undefined,
      followUp: async () => undefined,
      reply: async (payload: unknown) => {
        replies.push(payload);
      },
    } as unknown as ButtonInteraction;

    await honeypotService.handle_unban_button(interaction);
    assert.equal(unbans.length, 0);
    assert.equal(replies.length, 1);
  });
});
