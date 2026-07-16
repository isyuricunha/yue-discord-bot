import { describe, expect, test, vi } from 'vitest'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PanelAssistantMessage } from './PanelAssistantMessage'
import { toast_success } from '../../store/toast'

vi.mock('../../store/toast', () => ({
  toast_success: vi.fn(),
  toast_error: vi.fn(),
}))

describe('PanelAssistantMessage', () => {
  test('renders user message', () => {
    render(<PanelAssistantMessage role="user" content="Hello" />)
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  test('renders assistant message with markdown', () => {
    const { container } = render(<PanelAssistantMessage role="assistant" content="**bold** and *italic*" />)
    expect(container.querySelector('strong')).toBeTruthy()
    expect(container.querySelector('em')).toBeTruthy()
  })

  test('renders thinking indicator', () => {
    const { container } = render(<PanelAssistantMessage role="thinking" content="" />)
    expect(screen.getByText(/O assistente está pensando/i)).toBeTruthy()
    expect(container.querySelectorAll('.motion-reduce\\:animate-none')).toHaveLength(3)
  })

  test('renders error with retry button', () => {
    const onRetry = vi.fn()
    render(<PanelAssistantMessage role="error" content="Failed" onRetry={onRetry} isError />)
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('Tentar novamente')).toBeTruthy()
  })

  test('copy button calls clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<PanelAssistantMessage role="assistant" content="Hello world" />)
    const copyBtn = screen.getByLabelText('Copiar resposta')
    await userEvent.click(copyBtn)
    expect(writeText).toHaveBeenCalledWith('Hello world')
    expect(toast_success).toHaveBeenCalledWith('Resposta copiada.', 'Assistente')
  })
})
