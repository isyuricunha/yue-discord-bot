import { describe, expect, test, vi, beforeEach } from 'vitest'

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PanelAssistantPage from '../../pages/PanelAssistant'
import { PanelAssistantProvider } from './PanelAssistantProvider'

vi.mock('../../env', () => ({
  getApiUrl: () => 'http://localhost:3000',
}))

vi.mock('../../store/toast', () => ({
  toast_success: vi.fn(),
  toast_error: vi.fn(),
}))

const mockFetch = vi.fn()
window.fetch = mockFetch as unknown as typeof window.fetch

const FORBIDDEN_VISIBLE_TERMS = [
  'Mistral',
  'Custom Provider',
  'Bifrost',
  'NVIDIA',
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guild/guild-1/assistant']}>
      <PanelAssistantProvider>
        <PanelAssistantPage />
      </PanelAssistantProvider>
    </MemoryRouter>
  )
}

describe('PanelAssistantPage branding regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  test('page does not contain forbidden provider/model terminology', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, messages: [] }),
    })

    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText(/Tire d\u00favidas/i)).toBeTruthy())

    const bodyText = container.textContent ?? ''

    for (const term of FORBIDDEN_VISIBLE_TERMS) {
      expect(bodyText).not.toContain(term)
    }
  })

  test('page does not contain "model" or "runtime" in visible UI', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, messages: [] }),
    })

    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText(/Tire d\u00favidas/i)).toBeTruthy())

    const bodyText = container.textContent ?? ''

    // These words should not appear as standalone visible words
    // We use a regex with word boundaries but are lenient about substrings
    // in compound words or test attributes
    expect(bodyText.toLowerCase()).not.toMatch(/\bmodel\b/)
    expect(bodyText.toLowerCase()).not.toMatch(/\bruntime\b/)
    expect(bodyText.toLowerCase()).not.toMatch(/\bprovider\b/)
  })
})
