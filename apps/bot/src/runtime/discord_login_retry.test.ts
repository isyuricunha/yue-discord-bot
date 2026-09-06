import test from 'node:test';
import assert from 'node:assert/strict';

import { get_discord_login_retry } from './discord_login_retry';

test('waits until Discord resets the session-start limit', () => {
  const now = Date.parse('2026-09-06T18:00:00.000Z');
  const retry = get_discord_login_retry(
    new Error(
      'Not enough sessions remaining to spawn 1 shards; only 0 remaining; resets at 2026-09-07T00:27:59.938Z'
    ),
    0,
    now
  );

  assert.deepEqual(retry, {
    delay_ms: Date.parse('2026-09-07T00:27:59.938Z') - now + 1_000,
    reason: 'session_start_limit',
  });
});

test('uses capped exponential backoff for unrelated login failures', () => {
  assert.deepEqual(get_discord_login_retry(new Error('network unavailable'), 0, 0), {
    delay_ms: 1_000,
    reason: 'transient_failure',
  });
  assert.deepEqual(get_discord_login_retry(new Error('network unavailable'), 10, 0), {
    delay_ms: 300_000,
    reason: 'transient_failure',
  });
});
