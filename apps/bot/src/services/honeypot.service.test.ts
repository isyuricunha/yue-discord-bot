import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import type { ButtonInteraction, Message } from 'discord.js';

import { prisma } from '@yuebot/database';
import { honeypotService } from './honeypot.service';
import { HONEYPOT_UNBAN_BUTTON_PREFIX } from './honeypot.rules';

const STAFF_FLAGS = [PermissionFlagsBits.BanMembers];

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

interface create_message_options {
  guildId: string;
  channelId: string;
  authorId?: string;
  isClientAuthor?: boolean;
  isWebhook?: boolean;
  staffFlags?: bigint[] | null;
  content?: string;
  banError?: Error;
}

function create_message(options: create_message_options) {
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

  const message = {
    guild: {
      id: options.guildId,
      members: {
        ban: async (userId: string, banOptions: unknown) => {
          if (options.banError) throw options.banError;
          banCalls.push({ userId, options: banOptions });
          return undefined;
        },
      },
      channels: {
        fetch: async (channelId: string) => {
          if (channelId !== 'log-1') return null;
          return {
            isTextBased: () => true,
            send: async (payload: unknown) => {
              logSends.push(payload);
              return undefined;
            },
          };
        },
      },
    },
    author,
    client: { user: { id: 'client-1' } },
    channelId: options.channelId,
    channel: { id: options.channelId },
    webhookId: options.isWebhook ? 'webhook-1' : null,
    member: null,
    content: options.content ?? 'check my free crypto casino',
    delete: async () => {
      deleteCalls.push(1);
      return undefined;
    },
  } as unknown as Message;

  return { message, banCalls, deleteCalls, logSends };
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

  await t.test('deletes the trap message when the ban fails', async () => {
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
      assert.equal(prisma_state.modLogCreates.length, 1);
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

  await t.test('ignores staff members', async () => {
    const state = create_message({ guildId: 'guild-hp-1', channelId: 'trap-1', staffFlags: STAFF_FLAGS });
    (state.message as unknown as { member: unknown }).member = {
      permissions: { has: (flag: bigint) => STAFF_FLAGS.includes(flag) },
    };
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
            return undefined;
          },
        },
      },
      member: { permissions: { has: (flag: bigint) => STAFF_FLAGS.includes(flag) } },
      user: { id: 'staff-1', tag: 'staff#0001' },
      message: { components: [] },
      update: async (payload: unknown) => {
        updates.push(payload);
        return undefined;
      },
      followUp: async (payload: unknown) => {
        followUps.push(payload);
        return undefined;
      },
      reply: async (payload: unknown) => {
        followUps.push(payload);
        return undefined;
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

  await t.test('unban button rejects members without ban permission', async () => {
    const unbans: unknown[] = [];
    const replies: unknown[] = [];

    const interaction = {
      customId: `${HONEYPOT_UNBAN_BUTTON_PREFIX}100000000000000000`,
      guild: {
        id: 'guild-hp-1',
        members: {
          unban: async (userId: string) => {
            unbans.push(userId);
            return undefined;
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
        return undefined;
      },
    } as unknown as ButtonInteraction;

    await honeypotService.handle_unban_button(interaction);
    assert.equal(unbans.length, 0);
    assert.equal(replies.length, 1);
  });
});
