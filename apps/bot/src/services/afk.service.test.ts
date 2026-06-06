import test from 'node:test';
import assert from 'node:assert/strict';

import { AfkService, findFirstActiveAfk, type user_afk } from './afk.service';

function makeAfk(userId: string, isAfk = true): user_afk {
  return {
    id: `afk-${userId}`,
    userId,
    guildId: 'guild-1',
    reason: null,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    isAfk,
  };
}

test('AfkService.getAfks deduplicates users into one database query', async () => {
  const calls: unknown[] = [];
  const afks = [makeAfk('user-1'), makeAfk('user-2')];
  const service = new AfkService({
    userAfk: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return afks;
      },
    },
  } as any);

  assert.strictEqual(await service.getAfks(['user-1', 'user-2', 'user-1'], 'guild-1'), afks);
  assert.deepEqual(calls, [{
    where: {
      guildId: 'guild-1',
      userId: { in: ['user-1', 'user-2'] },
    },
  }]);
});

test('AfkService.getAfks skips the database for an empty user list', async () => {
  const service = new AfkService({
    userAfk: {
      findMany: async () => {
        throw new Error('findMany should not be called');
      },
    },
  } as any);

  assert.deepEqual(await service.getAfks([], 'guild-1'), []);
});

test('findFirstActiveAfk preserves mention order and ignores inactive rows', () => {
  const result = findFirstActiveAfk(
    ['user-1', 'user-2', 'user-3'],
    [makeAfk('user-3'), makeAfk('user-1', false), makeAfk('user-2')]
  );

  assert.equal(result?.userId, 'user-2');
});
