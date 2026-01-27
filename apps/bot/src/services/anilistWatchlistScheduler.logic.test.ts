import assert from 'node:assert/strict'
import test from 'node:test'

import { compute_watchlist_schedule_outcome, compute_watchlist_scheduler_outcome } from './anilistWatchlistScheduler.logic'

test('compute_watchlist_schedule_outcome: no next airing -> recheck later', () => {
  const res = compute_watchlist_schedule_outcome({
    nowMs: 1_000_000,
    nowSec: 1_000,
    next: null,
    lastNotifiedAiringAt: null,
  })

  assert.equal(res.kind, 'no_next')
  assert.equal(res.shouldNotify, false)
  assert.equal(res.nextAiringAt, null)
  assert.equal(res.nextAiringEpisode, null)
  assert.equal(res.nextCheckAtMs, 1_000_000 + 12 * 60 * 60 * 1000)
})

test('compute_watchlist_schedule_outcome: already aired and not notified -> notify', () => {
  const res = compute_watchlist_schedule_outcome({
    nowMs: 2_000_000,
    nowSec: 2_000,
    next: { airingAt: 1_500, episode: 7 },
    lastNotifiedAiringAt: null,
  })

  assert.equal(res.kind, 'notify')
  assert.equal(res.shouldNotify, true)
  assert.equal(res.nextAiringAt, 1_500)
  assert.equal(res.nextAiringEpisode, 7)
  assert.equal(res.nextCheckAtMs, 2_000_000 + 2 * 60 * 60 * 1000)
})

test('compute_watchlist_schedule_outcome: already aired but already notified -> recheck', () => {
  const res = compute_watchlist_schedule_outcome({
    nowMs: 3_000_000,
    nowSec: 3_000,
    next: { airingAt: 2_500, episode: 8 },
    lastNotifiedAiringAt: 2_500,
  })

  assert.equal(res.kind, 'recheck')
  assert.equal(res.shouldNotify, false)
  assert.equal(res.nextAiringAt, 2_500)
  assert.equal(res.nextAiringEpisode, 8)
  assert.equal(res.nextCheckAtMs, 3_000_000 + 2 * 60 * 60 * 1000)
})

test('compute_watchlist_schedule_outcome: future airing -> wait until airing time', () => {
  const res = compute_watchlist_schedule_outcome({
    nowMs: 4_000_000,
    nowSec: 4_000,
    next: { airingAt: 10_000, episode: 9 },
    lastNotifiedAiringAt: null,
  })

  assert.equal(res.kind, 'wait')
  assert.equal(res.shouldNotify, false)
  assert.equal(res.nextAiringAt, 10_000)
  assert.equal(res.nextAiringEpisode, 9)
  assert.equal(res.nextCheckAtMs, 10_000 * 1000)
})

test('compute_watchlist_scheduler_outcome: cached aired but AniList already advanced -> notify cached', () => {
  const res = compute_watchlist_scheduler_outcome({
    nowMs: 2_000_000,
    nowSec: 2_000,
    cachedNextAiringAt: 1_500,
    cachedNextAiringEpisode: 7,
    next: { airingAt: 10_000, episode: 8 },
    lastNotifiedAiringAt: null,
  })

  assert.equal(res.kind, 'notify_cached')
  assert.equal(res.shouldNotify, true)
  assert.equal(res.notifyAiringAt, 1_500)
  assert.equal(res.notifyEpisode, 7)
  assert.equal(res.nextAiringAt, 10_000)
  assert.equal(res.nextAiringEpisode, 8)
  assert.equal(res.nextCheckAtMs, 10_000 * 1000)
})

test('compute_watchlist_scheduler_outcome: cached aired but already notified -> do not notify', () => {
  const res = compute_watchlist_scheduler_outcome({
    nowMs: 2_000_000,
    nowSec: 2_000,
    cachedNextAiringAt: 1_500,
    cachedNextAiringEpisode: 7,
    next: { airingAt: 10_000, episode: 8 },
    lastNotifiedAiringAt: 1_500,
  })

  assert.equal(res.kind, 'wait')
  assert.equal(res.shouldNotify, false)
  assert.equal(res.notifyAiringAt, null)
  assert.equal(res.notifyEpisode, null)
  assert.equal(res.nextAiringAt, 10_000)
  assert.equal(res.nextAiringEpisode, 8)
  assert.equal(res.nextCheckAtMs, 10_000 * 1000)
})
