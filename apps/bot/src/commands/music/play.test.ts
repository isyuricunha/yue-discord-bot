import test from 'node:test';
import assert from 'node:assert/strict';

import { build_search_attempts, search_with_fallback } from './play';

test('build_search_attempts returns url-only attempt when query is url', () => {
  const attempts = build_search_attempts('https://example.com/foo');
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]?.label, 'url');
  assert.equal(attempts[0]?.source, undefined);
});

test('build_search_attempts returns ordered fallback attempts for non-url query', () => {
  const attempts = build_search_attempts('Rod Wave Leavin');
  assert.equal(attempts.length, 5);

  assert.deepEqual(attempts.map((a) => a.label), [
    'default',
    'youtube',
    'youtube_music',
    'soundcloud',
    'spotify',
  ]);

  assert.deepEqual(attempts.map((a) => a.source ?? null), [
    null,
    'ytsearch:',
    'ytmsearch:',
    'scsearch:',
    'spsearch:',
  ]);
});

test('search_with_fallback returns first result with tracks', async () => {
  const calls: Array<{ query: string; source?: string }> = [];

  const fake_search = async (
    query: string,
    options: { requester: unknown; source?: string }
  ) => {
    calls.push({ query, source: options.source });

    if (!options.source) return { tracks: [] as unknown[] };
    if (options.source === 'ytsearch:') return { tracks: [] as unknown[] };

    return { tracks: [{ title: 'ok' }] as unknown[] };
  };

  const result = await search_with_fallback(fake_search, 'query', { id: 'x' });
  assert.ok(result);
  assert.equal(result.tracks.length, 1);

  assert.deepEqual(calls.map((c) => c.source ?? null), [
    null,
    'ytsearch:',
    'ytmsearch:',
  ]);
});

test('search_with_fallback returns null when all attempts have 0 tracks', async () => {
  const fake_search = async () => ({ tracks: [] as unknown[] });

  const result = await search_with_fallback(fake_search, 'query', { id: 'x' });
  assert.equal(result, null);
});
