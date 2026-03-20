export type warn_threshold = {
  warns: number
  action: 'mute' | 'kick' | 'ban'
  duration?: string
}

export function find_triggered_warn_threshold(thresholds: warn_threshold[], current_warns: number): warn_threshold | null {
  if (!Array.isArray(thresholds) || thresholds.length === 0) return null
  const hit = thresholds.find((t) => typeof t.warns === 'number' && t.warns === current_warns)
  return hit ?? null
}
