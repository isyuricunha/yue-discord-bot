import {
  is_panel_ai_apply_page_key,
  type panel_ai_action,
  type panel_ai_apply_diff_change,
  type panel_ai_apply_proposal,
  type panel_ai_apply_result,
  type panel_ai_prefill_value,
} from '@yuebot/shared'

import { getApiUrl } from '../../env'

const API_URL = getApiUrl()

type prefill_action = Extract<panel_ai_action, { type: 'prefill_form' }>

export type prepare_server_apply_result =
  | { ok: true; noop: true; proposal: null }
  | { ok: true; noop: false; proposal: panel_ai_apply_proposal }
  | { ok: false; status: number; error: string }

export type confirm_server_apply_result =
  | { ok: true; result: panel_ai_apply_result }
  | { ok: false; status: number; error: string }

function is_prefill_value(value: unknown): value is panel_ai_prefill_value {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function parse_diff_change(value: unknown): panel_ai_apply_diff_change | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const change = value as Record<string, unknown>
  if (
    typeof change.target !== 'string' ||
    typeof change.targetLabel !== 'string' ||
    !is_prefill_value(change.before) ||
    !is_prefill_value(change.after)
  ) return null
  return {
    target: change.target,
    targetLabel: change.targetLabel,
    before: change.before,
    after: change.after,
  }
}

function parse_proposal(value: unknown): panel_ai_apply_proposal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const proposal = value as Record<string, unknown>
  if (
    typeof proposal.id !== 'string' ||
    !is_panel_ai_apply_page_key(proposal.pageKey) ||
    typeof proposal.expiresAt !== 'string' ||
    !Array.isArray(proposal.changes) ||
    proposal.changes.length === 0 ||
    proposal.changes.length > 6
  ) return null

  const changes = proposal.changes.map(parse_diff_change)
  if (changes.some((change) => change === null)) return null
  return {
    id: proposal.id,
    pageKey: proposal.pageKey,
    changes: changes as panel_ai_apply_diff_change[],
    expiresAt: proposal.expiresAt,
  }
}

function parse_apply_result(value: unknown): panel_ai_apply_result | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (
    typeof result.proposalId !== 'string' ||
    !is_panel_ai_apply_page_key(result.pageKey) ||
    typeof result.appliedAt !== 'string' ||
    typeof result.replayed !== 'boolean' ||
    !Array.isArray(result.changes) ||
    result.changes.length === 0 ||
    result.changes.length > 6
  ) return null

  const changes = result.changes.map(parse_diff_change)
  if (changes.some((change) => change === null)) return null
  return {
    proposalId: result.proposalId,
    pageKey: result.pageKey,
    changes: changes as panel_ai_apply_diff_change[],
    appliedAt: result.appliedAt,
    replayed: result.replayed,
  }
}

async function error_from_response(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  return typeof payload?.error === 'string' ? payload.error : fallback
}

export function can_apply_panel_ai_action(action: panel_ai_action): action is prefill_action {
  return action.type === 'prefill_form' && is_panel_ai_apply_page_key(action.pageKey)
}

export async function prepare_panel_ai_server_apply(
  guildId: string,
  action: prefill_action,
): Promise<prepare_server_apply_result> {
  if (!guildId || !can_apply_panel_ai_action(action)) {
    return { ok: false, status: 400, error: 'Invalid apply proposal' }
  }

  try {
    const response = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}/panel-ai/apply-proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        pageKey: action.pageKey,
        changes: action.changes.map((change) => ({ target: change.target, value: change.value })),
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: await error_from_response(response, 'Could not prepare configuration changes'),
      }
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!payload || payload.success !== true || typeof payload.noop !== 'boolean') {
      return { ok: false, status: 502, error: 'Invalid apply proposal response' }
    }
    if (payload.noop === true) return { ok: true, noop: true, proposal: null }

    const proposal = parse_proposal(payload.proposal)
    if (!proposal || proposal.pageKey !== action.pageKey) {
      return { ok: false, status: 502, error: 'Invalid apply proposal response' }
    }
    return { ok: true, noop: false, proposal }
  } catch {
    return { ok: false, status: 0, error: 'Falha na comunicação' }
  }
}

export async function confirm_panel_ai_server_apply(
  guildId: string,
  proposalId: string,
): Promise<confirm_server_apply_result> {
  if (!guildId || !proposalId) return { ok: false, status: 400, error: 'Invalid apply proposal' }

  try {
    const response = await fetch(
      `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/panel-ai/apply-proposals/${encodeURIComponent(proposalId)}/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      },
    )

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: await error_from_response(response, 'Could not apply configuration changes'),
      }
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    const result = payload?.success === true ? parse_apply_result(payload.result) : null
    return result
      ? { ok: true, result }
      : { ok: false, status: 502, error: 'Invalid apply confirmation response' }
  } catch {
    return { ok: false, status: 0, error: 'Falha na comunicação' }
  }
}
