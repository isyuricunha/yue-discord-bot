export function is_within_continuation_window(input: {
  now_ms: number
  last_activity_ms: number | null
  continuation_seconds: number
}): boolean {
  const seconds = Number.isFinite(input.continuation_seconds) ? input.continuation_seconds : 0
  const window_seconds = Math.max(0, Math.floor(seconds))

  if (window_seconds <= 0) return false
  if (typeof input.last_activity_ms !== 'number' || !Number.isFinite(input.last_activity_ms)) return false

  return input.now_ms - input.last_activity_ms <= window_seconds * 1000
}
