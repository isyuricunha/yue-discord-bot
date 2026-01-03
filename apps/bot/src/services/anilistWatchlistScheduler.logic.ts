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
