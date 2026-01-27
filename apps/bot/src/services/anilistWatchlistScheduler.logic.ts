export type anilist_next_airing = { airingAt: number; episode: number }

export type watchlist_schedule_outcome =
  | {
      kind: 'no_next'
      nextAiringAt: null
      nextAiringEpisode: null
      nextCheckAtMs: number
      shouldNotify: false
    }
  | {
      kind: 'notify'
      nextAiringAt: number
      nextAiringEpisode: number
      nextCheckAtMs: number
      shouldNotify: true
    }
  | {
      kind: 'recheck'
      nextAiringAt: number
      nextAiringEpisode: number
      nextCheckAtMs: number
      shouldNotify: false
    }
  | {
      kind: 'wait'
      nextAiringAt: number
      nextAiringEpisode: number
      nextCheckAtMs: number
      shouldNotify: false
    }

export function compute_watchlist_schedule_outcome(input: {
  nowMs: number
  nowSec: number
  next: anilist_next_airing | null
  lastNotifiedAiringAt: number | null
}): watchlist_schedule_outcome {
  const recheck_after_ms = 2 * 60 * 60 * 1000
  const no_next_recheck_ms = 12 * 60 * 60 * 1000

  if (!input.next) {
    return {
      kind: 'no_next',
      nextAiringAt: null,
      nextAiringEpisode: null,
      nextCheckAtMs: input.nowMs + no_next_recheck_ms,
      shouldNotify: false,
    }
  }

  const nextAiringAt = input.next.airingAt
  const nextAiringEpisode = input.next.episode

  if (nextAiringAt <= input.nowSec) {
    if (input.lastNotifiedAiringAt !== nextAiringAt) {
      return {
        kind: 'notify',
        nextAiringAt,
        nextAiringEpisode,
        nextCheckAtMs: input.nowMs + recheck_after_ms,
        shouldNotify: true,
      }
    }

    return {
      kind: 'recheck',
      nextAiringAt,
      nextAiringEpisode,
      nextCheckAtMs: input.nowMs + recheck_after_ms,
      shouldNotify: false,
    }
  }

  return {
    kind: 'wait',
    nextAiringAt,
    nextAiringEpisode,
    nextCheckAtMs: nextAiringAt * 1000,
    shouldNotify: false,
  }
}

export type watchlist_scheduler_outcome = {
  kind: watchlist_schedule_outcome['kind'] | 'notify_cached'
  shouldNotify: boolean
  notifyAiringAt: number | null
  notifyEpisode: number | null
  nextAiringAt: number | null
  nextAiringEpisode: number | null
  nextCheckAtMs: number
}

export function compute_watchlist_scheduler_outcome(input: {
  nowMs: number
  nowSec: number
  cachedNextAiringAt: number | null
  cachedNextAiringEpisode: number | null
  next: anilist_next_airing | null
  lastNotifiedAiringAt: number | null
}): watchlist_scheduler_outcome {
  const recheck_after_ms = 2 * 60 * 60 * 1000
  const no_next_recheck_ms = 12 * 60 * 60 * 1000

  const cached_airing_at = input.cachedNextAiringAt
  const cached_episode = input.cachedNextAiringEpisode

  const has_cached_next =
    typeof cached_airing_at === 'number' &&
    Number.isFinite(cached_airing_at) &&
    typeof cached_episode === 'number' &&
    Number.isFinite(cached_episode)

  if (
    has_cached_next &&
    cached_airing_at <= input.nowSec &&
    input.lastNotifiedAiringAt !== cached_airing_at
  ) {
    const next_check_at_ms = input.next
      ? input.next.airingAt > input.nowSec
        ? input.next.airingAt * 1000
        : input.nowMs + recheck_after_ms
      : input.nowMs + no_next_recheck_ms

    return {
      kind: 'notify_cached',
      shouldNotify: true,
      notifyAiringAt: cached_airing_at,
      notifyEpisode: cached_episode,
      nextAiringAt: input.next?.airingAt ?? null,
      nextAiringEpisode: input.next?.episode ?? null,
      nextCheckAtMs: next_check_at_ms,
    }
  }

  const outcome = compute_watchlist_schedule_outcome({
    nowMs: input.nowMs,
    nowSec: input.nowSec,
    next: input.next,
    lastNotifiedAiringAt: input.lastNotifiedAiringAt,
  })

  return {
    kind: outcome.kind,
    shouldNotify: outcome.shouldNotify,
    notifyAiringAt: outcome.shouldNotify ? outcome.nextAiringAt : null,
    notifyEpisode: outcome.shouldNotify ? outcome.nextAiringEpisode : null,
    nextAiringAt: outcome.nextAiringAt,
    nextAiringEpisode: outcome.nextAiringEpisode,
    nextCheckAtMs: outcome.nextCheckAtMs,
  }
}
