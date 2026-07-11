const TABBABLE_SELECTOR = [
  'a[href]',
  'button',
  'textarea',
  'input:not([type="hidden"])',
  'select',
  '[tabindex]',
  '[contenteditable="true"]',
].join(', ')

export function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((element) => {
    const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'
    const excluded = Boolean(element.closest('[hidden], [aria-hidden="true"], [inert]'))
    const tabIndex = element.getAttribute('tabindex')
    return !disabled && !excluded && (tabIndex === null || Number(tabIndex) >= 0)
  })
}
