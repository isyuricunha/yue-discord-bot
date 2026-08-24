import { flushSync } from 'react-dom'
import {
  get_panel_ai_prefill_field,
  validate_panel_ai_prefill_value,
  type panel_ai_action,
  type panel_ai_page_key,
  type panel_ai_prefill_change,
  type panel_ai_prefill_field,
} from '@yuebot/shared'

type prefill_action = Extract<panel_ai_action, { type: 'prefill_form' }>

export type panel_ai_prefill_result = {
  applied: number
  failed: number
  reason?: 'wrong-page' | 'invalid-action'
}

function normalize_text(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function element_text(element: Element) {
  return normalize_text(element.textContent ?? '')
}

function find_text_anchor(label: string): HTMLElement | null {
  const expected = normalize_text(label)
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('label, h1, h2, h3, h4, span, p, div'),
  ).filter((element) => element.textContent && element.getAttribute('aria-hidden') !== 'true')

  return elements.find((element) => element_text(element) === expected)
    ?? elements.find((element) => {
      const text = element_text(element)
      return text.length <= expected.length + 40 && text.includes(expected)
    })
    ?? null
}

function find_nearest<T extends Element>(
  anchor: HTMLElement,
  find: (container: HTMLElement) => T | null,
): T | null {
  let container: HTMLElement | null = anchor
  for (let depth = 0; container && depth < 8; depth += 1, container = container.parentElement) {
    const result = find(container)
    if (result) return result
  }
  return null
}

function find_button_by_text(root: ParentNode, label: string): HTMLButtonElement | null {
  const expected = normalize_text(label)
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => element_text(button) === expected) ?? null
}

function set_native_value(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (!setter) return false

  setter.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function next_task() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

async function wait_for<T>(read: () => T | null, attempts = 20): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = read()
    if (value) return value
    await new Promise<void>((resolve) => window.setTimeout(resolve, 25))
  }
  return null
}

function find_switch(field: Extract<panel_ai_prefill_field, { control: 'switch' }>) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="switch"]'))
    .find((button) => normalize_text(button.getAttribute('aria-label') ?? '') === normalize_text(field.ariaLabel))
    ?? null
}

async function apply_switch(
  field: Extract<panel_ai_prefill_field, { control: 'switch' }>,
  value: boolean,
) {
  const control = find_switch(field)
  if (!control || control.disabled) return false

  const checked = control.getAttribute('aria-checked') === 'true'
  if (checked !== value) {
    control.click()
    await next_task()
  }
  return true
}

async function apply_input(
  field: Extract<panel_ai_prefill_field, { control: 'input' }>,
  value: number,
) {
  const anchor = find_text_anchor(field.label)
  if (!anchor) return false
  const input = find_nearest(anchor, (container) =>
    container.querySelector<HTMLInputElement>('input:not([type="hidden"])'),
  )
  if (!input || input.disabled) return false
  return set_native_value(input, String(value))
}

async function apply_select(
  field: Extract<panel_ai_prefill_field, { control: 'select' }>,
  value: string,
) {
  const option = field.options.find((candidate) => candidate.value === value)
  if (!option) return false

  const anchor = find_text_anchor(field.label)
  if (!anchor) return false
  const trigger = find_nearest(anchor, (container) =>
    container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]'),
  )
  if (!trigger || trigger.disabled) return false

  // The Select renders its menu in a portal after opening. Flush the trigger
  // update so the portal can materialize before we resolve the allowlisted option.
  flushSync(() => trigger.click())
  await next_task()
  const choice = await wait_for(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="option"]'))
      .find((candidate) => element_text(candidate) === normalize_text(option.label)) ?? null,
  )
  if (!choice || choice.disabled) return false
  flushSync(() => choice.click())
  await next_task()
  return true
}

async function apply_message_editor(
  field: Extract<panel_ai_prefill_field, { control: 'message_editor' }>,
  value: string,
) {
  const anchor = find_text_anchor(field.label)
  if (!anchor) return false
  const advancedToggle = find_nearest(anchor, (container) => find_button_by_text(container, 'Modo avançado'))
  if (!advancedToggle || advancedToggle.disabled) return false

  if (advancedToggle.getAttribute('aria-expanded') !== 'true') {
    advancedToggle.click()
  }

  const editor = await wait_for(() => {
    const container = find_nearest(anchor, (candidate) =>
      find_button_by_text(candidate, 'Aplicar') ? candidate : null,
    )
    return container?.querySelector<HTMLTextAreaElement>('textarea') ?? null
  })
  if (!editor || editor.disabled || !set_native_value(editor, value)) return false

  const applyButton = await wait_for(() => {
    const container = find_nearest(anchor, (candidate) =>
      find_button_by_text(candidate, 'Aplicar') ? candidate : null,
    )
    const button = container ? find_button_by_text(container, 'Aplicar') : null
    return button && !button.disabled ? button : null
  })
  if (!applyButton) return false
  applyButton.click()
  await next_task()
  return true
}

async function apply_change(
  pageKey: panel_ai_page_key,
  change: panel_ai_prefill_change,
): Promise<boolean> {
  const field = get_panel_ai_prefill_field(pageKey, change.target)
  const validated = validate_panel_ai_prefill_value(pageKey, change.target, change.value)
  if (!field || !validated) return false

  if (field.control === 'switch' && typeof validated.value === 'boolean') {
    return apply_switch(field, validated.value)
  }
  if (field.control === 'input' && typeof validated.value === 'number') {
    return apply_input(field, validated.value)
  }
  if (field.control === 'select' && typeof validated.value === 'string') {
    return apply_select(field, validated.value)
  }
  if (field.control === 'message_editor' && typeof validated.value === 'string') {
    return apply_message_editor(field, validated.value)
  }
  return false
}

export async function apply_panel_ai_prefill_action(
  action: prefill_action,
  currentPageKey: panel_ai_page_key | null,
): Promise<panel_ai_prefill_result> {
  if (currentPageKey !== action.pageKey) {
    return { applied: 0, failed: action.changes.length, reason: 'wrong-page' }
  }

  const validated = action.changes.every((change) =>
    Boolean(
      get_panel_ai_prefill_field(action.pageKey, change.target)
      && validate_panel_ai_prefill_value(action.pageKey, change.target, change.value),
    ),
  )
  if (!validated) {
    return { applied: 0, failed: action.changes.length, reason: 'invalid-action' }
  }

  // Enable/disable switches first because several pages conditionally render
  // the numeric/select controls that depend on those switches.
  const ordered = action.changes.slice().sort((a, b) => {
    const aField = get_panel_ai_prefill_field(action.pageKey, a.target)
    const bField = get_panel_ai_prefill_field(action.pageKey, b.target)
    return Number(bField?.control === 'switch') - Number(aField?.control === 'switch')
  })

  let applied = 0
  let failed = 0
  for (const change of ordered) {
    if (await apply_change(action.pageKey, change)) applied += 1
    else failed += 1
  }

  return { applied, failed }
}
