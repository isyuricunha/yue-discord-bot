import {
  get_panel_ai_prefill_field,
  validate_panel_ai_prefill_value,
  type panel_ai_prefill_change,
  type panel_ai_prefill_value,
} from './panel_ai_assistant'
import type { panel_ai_page_key } from './panel_ai_pages'

export const PANEL_AI_APPLY_PAGE_KEYS = [
  'settings',
  'automod',
  'antiraid',
  'xp',
  'autorole',
] as const satisfies readonly panel_ai_page_key[]

export type panel_ai_apply_page_key = (typeof PANEL_AI_APPLY_PAGE_KEYS)[number]

export type panel_ai_apply_diff_change = {
  target: string
  targetLabel: string
  before: panel_ai_prefill_value
  after: panel_ai_prefill_value
}

export type panel_ai_apply_proposal = {
  id: string
  pageKey: panel_ai_apply_page_key
  changes: panel_ai_apply_diff_change[]
  expiresAt: string
}

export type panel_ai_apply_result = {
  proposalId: string
  pageKey: panel_ai_apply_page_key
  changes: panel_ai_apply_diff_change[]
  appliedAt: string
  replayed: boolean
}

export function is_panel_ai_apply_page_key(value: unknown): value is panel_ai_apply_page_key {
  return typeof value === 'string' && (PANEL_AI_APPLY_PAGE_KEYS as readonly string[]).includes(value)
}

export function validate_panel_ai_apply_changes(
  pageKey: panel_ai_apply_page_key,
  value: unknown,
  maxChanges = 6,
): panel_ai_prefill_change[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxChanges) return null

  const seen = new Set<string>()
  const changes: panel_ai_prefill_change[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const raw = item as { target?: unknown; value?: unknown }
    if (typeof raw.target !== 'string' || seen.has(raw.target)) return null

    const field = get_panel_ai_prefill_field(pageKey, raw.target)
    const validated = validate_panel_ai_prefill_value(pageKey, raw.target, raw.value)
    if (!field || !validated) return null

    seen.add(raw.target)
    changes.push({
      target: raw.target,
      targetLabel: field.label,
      value: validated.value,
    })
  }

  return changes
}
