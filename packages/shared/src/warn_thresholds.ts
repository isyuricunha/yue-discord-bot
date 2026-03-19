import type { WarnThreshold } from './validators'

export function find_triggered_warn_threshold(thresholds: WarnThreshold[], current_warns: number): WarnThreshold | null {
  if (!Array.isArray(thresholds) || thresholds.length === 0) return null
  const hit = thresholds.find((t) => typeof t.warns === 'number' && t.warns === current_warns)
  return hit ?? null
}
