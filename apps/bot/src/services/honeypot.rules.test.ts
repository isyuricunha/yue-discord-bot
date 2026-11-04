import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HONEYPOT_DELETE_MESSAGE_SECONDS,
  HONEYPOT_UNBAN_BUTTON_PREFIX,
  honeypot_unban_target,
  should_catch_honeypot_message,
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
        has_staff_permission: false,
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
        has_staff_permission: false,
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
        has_staff_permission: false,
      }),
      false,
    );
  });

  await t.test('ignores webhooks, the bot itself and staff', () => {
    const base = {
      config_channel_id: 'trap-1',
      channel_id: 'trap-1',
      author_id: 'user-1',
      client_user_id: 'client-1',
      is_webhook: false,
      has_staff_permission: false,
    };
    assert.equal(should_catch_honeypot_message({ ...base, is_webhook: true }), false);
    assert.equal(
      should_catch_honeypot_message({ ...base, author_id: 'client-1' }),
      false,
    );
    assert.equal(
      should_catch_honeypot_message({ ...base, has_staff_permission: true }),
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
});
