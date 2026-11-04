import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';

import {
  HONEYPOT_DELETE_MESSAGE_SECONDS,
  HONEYPOT_UNBAN_BUTTON_PREFIX,
  has_ban_permission,
  has_staff_permission,
  honeypot_unban_target,
  should_catch_honeypot_message,
  truncate_code_points,
} from './honeypot.rules';

test('honeypot rules', async (t) => {
  await t.test('catches a regular member posting in the configured trap channel', () => {
    assert.equal(
      should_catch_honeypot_message({
        config_channel_id: 'trap-1',
        channel_id: 'trap-1',
        author_id: 'user-1',
        client_user_id: 'client-1',
        is_webhook: false,
      }),
      true,
    );
  });

  await t.test('ignores other channels', () => {
    assert.equal(
      should_catch_honeypot_message({
        config_channel_id: 'trap-1',
        channel_id: 'general-1',
        author_id: 'user-1',
        client_user_id: 'client-1',
        is_webhook: false,
      }),
      false,
    );
  });

  await t.test('ignores guilds without a trap channel', () => {
    assert.equal(
      should_catch_honeypot_message({
        config_channel_id: null,
        channel_id: 'trap-1',
        author_id: 'user-1',
        client_user_id: 'client-1',
        is_webhook: false,
      }),
      false,
    );
  });

  await t.test('ignores webhooks and the bot itself', () => {
    const base = {
      config_channel_id: 'trap-1',
      channel_id: 'trap-1',
      author_id: 'user-1',
      client_user_id: 'client-1',
      is_webhook: false,
    };
    assert.equal(should_catch_honeypot_message({ ...base, is_webhook: true }), false);
    assert.equal(
      should_catch_honeypot_message({ ...base, author_id: 'client-1' }),
      false,
    );
  });

  await t.test('deletion window matches the documented ten-minute sweep', () => {
    assert.equal(HONEYPOT_DELETE_MESSAGE_SECONDS, 600);
  });

  await t.test('unban target parses only valid snowflake ids', () => {
    assert.equal(honeypot_unban_target(`${HONEYPOT_UNBAN_BUTTON_PREFIX}100000000000000000`), '100000000000000000');
    assert.equal(honeypot_unban_target(`${HONEYPOT_UNBAN_BUTTON_PREFIX}not-an-id`), null);
    assert.equal(honeypot_unban_target('other:100000000000000000'), null);
    assert.equal(honeypot_unban_target(HONEYPOT_UNBAN_BUTTON_PREFIX), null);
  });

  await t.test('staff exemption covers the three staff permissions, unban requires BanMembers', () => {
    const all = {
      has: (flag: bigint) =>
        flag === PermissionFlagsBits.BanMembers ||
        flag === PermissionFlagsBits.ModerateMembers ||
        flag === PermissionFlagsBits.ManageGuild,
    };
    const mute_only = { has: (flag: bigint) => flag === PermissionFlagsBits.ModerateMembers };

    assert.equal(has_staff_permission(all), true);
    assert.equal(has_staff_permission(mute_only), true);
    assert.equal(has_staff_permission(null), false);
    assert.equal(has_ban_permission(all), true);
    assert.equal(has_ban_permission(mute_only), false);
    assert.equal(has_ban_permission(null), false);
  });

  await t.test('truncation never splits a surrogate pair', () => {
    const emoji = '🎉'.repeat(300);
    // Border and no-truncation cases stay intact.
    assert.equal(truncate_code_points(emoji, 300), emoji);
    assert.equal(truncate_code_points(emoji, 500), emoji);
    // A UTF-16 slice at 299 would end mid-surrogate; code-point truncation must not.
    const truncated = truncate_code_points(emoji, 299);
    assert.equal(truncated, '🎉'.repeat(299));
    assert.equal(Array.from(truncated).length, 299);
    assert.equal(truncate_code_points('hello', 500), 'hello');
    assert.equal(truncate_code_points('hello', 3), 'hel');
    assert.equal(truncate_code_points('', 500), '');
  });
});
