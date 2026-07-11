import { describe, expect, test } from 'vitest'

import { getTabbableElements } from './tabbable'

describe('getTabbableElements', () => {
  test('includes normal controls and excludes disabled, hidden, inert, and negative-tabindex content', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <a href="/settings" id="link">Settings</a>
      <input id="input" />
      <select id="select"><option>One</option></select>
      <div contenteditable="true" id="editable"></div>
      <button disabled id="disabled">Disabled</button>
      <button aria-disabled="true" id="aria-disabled">ARIA disabled</button>
      <button tabindex="-1" id="negative">Negative</button>
      <div hidden><button id="hidden">Hidden</button></div>
      <div aria-hidden="true"><button id="aria-hidden">ARIA hidden</button></div>
      <div inert><button id="inert">Inert</button></div>
    `

    expect(getTabbableElements(container).map((element) => element.id)).toEqual([
      'link',
      'input',
      'select',
      'editable',
    ])
  })
})
