import { randomUUID } from 'node:crypto'
import {
  PANEL_AI_PREFILL_FIELDS,
  describe_panel_ai_prefill_field,
  find_panel_ai_page,
  get_panel_ai_action_target,
  get_panel_ai_prefill_field,
  validate_panel_ai_prefill_value,
  type panel_ai_action,
  type panel_ai_page_key,
  type panel_ai_prefill_change,
  type panel_ai_sensitive_scope,
} from '@yuebot/shared'

const ACTIONS_TAG = 'PANEL_ACTIONS'
const SENSITIVE_TAG = 'PANEL_SENSITIVE_REQUEST'
const PROTOCOL_PREFIX = '<PANEL_'
const MAX_ACTIONS = 3
const MAX_PREFILL_CHANGES = 6

const SENSITIVE_SCOPES = new Set<panel_ai_sensitive_scope>([
  'member_moderation',
  'recent_modlogs',
  'recent_tickets',
  'giveaway_participants',
])

const PREFILL_ALLOWLIST = Object.entries(PANEL_AI_PREFILL_FIELDS)
  .map(([pageKey, fields]) => {
    const targets = Object.entries(fields ?? {})
      .map(([target, field]) => `${target}:${describe_panel_ai_prefill_field(field)}`)
      .join(', ')
    return `${pageKey}[${targets}]`
  })
  .join('; ')

export const PANEL_AI_PROTOCOL_RULES = [
  'Optional machine-readable directives may be appended only after the user-facing answer.',
  `For panel actions, append <${ACTIONS_TAG}> followed by a JSON array and </${ACTIONS_TAG}>.`,
  'Read-only actions are: {"type":"navigate","pageKey":"..."}, {"type":"open_section","pageKey":"...","target":"..."}, or {"type":"highlight_setting","pageKey":"...","target":"..."}.',
  `A form configuration action is {"type":"prefill_form","pageKey":"...","changes":[{"target":"...","value":...}]}. Use at most ${MAX_PREFILL_CHANGES} changes.`,
  'A prefill_form may target any allowlisted panel page, not only the page currently open. The panel can navigate to the target page for local preparation and can separately offer an administrator-confirmed server apply.',
  'When the administrator explicitly asks you to enable, disable, set, change, configure, prepare, prefill, or adjust an allowlisted setting, emit the matching prefill_form action instead of only giving manual instructions.',
  'Do not tell the administrator to navigate manually when the requested change can be represented by an allowlisted prefill_form action.',
  'Example: if asked to enable AI moderation and make it permissive, emit a prefill_form for pageKey "automod" with aiModerationEnabled=true and aiModerationLevel="permissivo".',
  `Prefill allowlist and value constraints: ${PREFILL_ALLOWLIST}.`,
  'Never invent a prefill page, target, value type, enum value, selector, URL, endpoint, or hidden identifier. If a desired field is not allowlisted, explain that it cannot be prepared automatically.',
  `Use at most ${MAX_ACTIONS} actions. Never invent page keys or target keys.`,
  `When sensitive data is genuinely needed and an allowed scope is listed in context, ask the user for permission in normal language and append <${SENSITIVE_TAG}>{"scope":"..."}</${SENSITIVE_TAG}>.`,
  'Never include sensitive values yourself before explicit user confirmation.',
  'Never claim that a UI action already executed. These directives offer real panel actions the administrator may choose to run.',
  'Never claim that values were persisted before the administrator confirms the server-side apply. A local prefill remains unsaved until the normal form is saved.',
].join('\n')

type raw_prefill_change = {
  target?: unknown
  value?: unknown
}

type raw_action = {
  type?: unknown
  pageKey?: unknown
  target?: unknown
  changes?: unknown
}

function extract_tag(text: string, tag: string): { value: string | null; stripped: string } {
  const expression = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i')
  const match = expression.exec(text)
  if (!match) return { value: null, stripped: text }
  return {
    value: match[1] ?? null,
    stripped: `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`,
  }
}

function parse_prefill_changes(pageKey: panel_ai_page_key, value: unknown): panel_ai_prefill_change[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PREFILL_CHANGES) return null

  const seen = new Set<string>()
  const changes: panel_ai_prefill_change[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const raw = item as raw_prefill_change
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

function parse_action(value: unknown): panel_ai_action | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as raw_action
  if (typeof raw.type !== 'string' || typeof raw.pageKey !== 'string') return null
  const page = find_panel_ai_page(raw.pageKey)
  if (!page) return null
  const pageKey = page.key as panel_ai_page_key

  if (raw.type === 'navigate') {
    // A plain navigation action must not require an entity id the assistant
    // cannot safely invent. Dynamic detail pages are still reachable through
    // their existing panel UI.
    const extra_params = [...page.routePattern.matchAll(/:([A-Za-z0-9_]+)/g)]
      .map((match) => match[1])
      .filter((name) => name !== 'guildId')
    if (extra_params.length > 0) return null
    return {
      id: randomUUID(),
      type: 'navigate',
      pageKey,
      label: `Abrir ${page.title}`,
    }
  }

  if (raw.type === 'prefill_form') {
    const changes = parse_prefill_changes(pageKey, raw.changes)
    if (!changes) return null
    return {
      id: randomUUID(),
      type: 'prefill_form',
      pageKey,
      changes,
      label: changes.length === 1 ? 'Preparar alteração' : `Preparar ${changes.length} alterações`,
    }
  }

  if (raw.type !== 'open_section' && raw.type !== 'highlight_setting') return null
  if (typeof raw.target !== 'string') return null
  const target = get_panel_ai_action_target(pageKey, raw.type, raw.target)
  if (!target) return null
  return {
    id: randomUUID(),
    type: raw.type,
    pageKey,
    target: raw.target,
    targetLabel: target.label,
    label: raw.type === 'open_section' ? `Abrir ${target.label}` : `Destacar ${target.label}`,
  }
}

export type parsed_panel_ai_output = {
  response: string
  actions: panel_ai_action[]
  sensitiveScope: panel_ai_sensitive_scope | null
}

export function parse_panel_ai_output(text: string): parsed_panel_ai_output {
  const sensitive = extract_tag(text, SENSITIVE_TAG)
  const actions = extract_tag(sensitive.stripped, ACTIONS_TAG)

  let parsed_actions: panel_ai_action[] = []
  if (actions.value) {
    try {
      const raw = JSON.parse(actions.value) as unknown
      if (Array.isArray(raw)) {
        parsed_actions = raw
          .slice(0, MAX_ACTIONS)
          .map(parse_action)
          .filter((action): action is panel_ai_action => action !== null)
      }
    } catch {
      parsed_actions = []
    }
  }

  let sensitive_scope: panel_ai_sensitive_scope | null = null
  if (sensitive.value) {
    try {
      const raw = JSON.parse(sensitive.value) as { scope?: unknown }
      if (typeof raw.scope === 'string' && SENSITIVE_SCOPES.has(raw.scope as panel_ai_sensitive_scope)) {
        sensitive_scope = raw.scope as panel_ai_sensitive_scope
      }
    } catch {
      sensitive_scope = null
    }
  }

  // Remove malformed or unterminated protocol tails as a final defense against
  // leaking internal directives into the visible chat.
  const visible = actions.stripped.split(PROTOCOL_PREFIX, 1)[0]?.trim() ?? ''
  return {
    response: visible,
    actions: parsed_actions,
    sensitiveScope: sensitive_scope,
  }
}

export class PanelAiProtocolStreamFilter {
  private pending = ''
  private captured_protocol = false

  push(delta: string): string {
    if (!delta) return ''
    this.pending += delta

    if (this.captured_protocol) return ''

    const marker_index = this.pending.indexOf(PROTOCOL_PREFIX)
    if (marker_index >= 0) {
      this.captured_protocol = true
      const visible = this.pending.slice(0, marker_index)
      this.pending = this.pending.slice(marker_index)
      return visible
    }

    // Keep only enough characters to detect a protocol prefix split between
    // provider chunks. Everything before that can stream immediately.
    const keep = Math.min(this.pending.length, PROTOCOL_PREFIX.length - 1)
    const emit_length = this.pending.length - keep
    if (emit_length <= 0) return ''
    const visible = this.pending.slice(0, emit_length)
    this.pending = this.pending.slice(emit_length)
    return visible
  }

  finish(): string {
    if (this.captured_protocol) return ''
    const visible = this.pending
    this.pending = ''
    return visible
  }
}
