import { describe, expect, test, vi, beforeEach } from 'vitest'

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'

import { PanelAssistantComposer } from './PanelAssistantComposer'

describe('PanelAssistantComposer', () => {
  const onChange = vi.fn()
  const onSend = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders textarea with placeholder', () => {
    render(<PanelAssistantComposer value="" onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.getByPlaceholderText(/Pergunte algo/i)).toBeTruthy()
  })

  test('Enter sends message', async () => {
    const { container } = render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={false} />)
    const textarea = container.querySelector('textarea')!
    await userEvent.type(textarea, '{Enter}')
    expect(onSend).toHaveBeenCalled()
  })

  test('Shift+Enter creates newline', async () => {
    const { container } = render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={false} />)
    const textarea = container.querySelector('textarea')!
    await userEvent.type(textarea, '{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
  })

  test('disabled state disables send', async () => {
    const { container } = render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={true} />)
    const textarea = container.querySelector('textarea')!
    expect(textarea.disabled).toBe(true)
  })

  test('shows character counter near limit', () => {
    const longText = 'x'.repeat(3700)
    render(<PanelAssistantComposer value={longText} onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.getByText('300')).toBeTruthy()
  })

  test('shows the character counter at exactly 3600 characters', () => {
    render(<PanelAssistantComposer value={'x'.repeat(3600)} onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.getByText('400')).toBeInTheDocument()
  })

  test('does not show the character counter below 3600 characters', () => {
    render(<PanelAssistantComposer value={'x'.repeat(3599)} onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.queryByText('401')).not.toBeInTheDocument()
  })

  test('does not show counter when far from limit', () => {
    render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.queryByText('3995')).toBeFalsy()
  })

  test('send button triggers send', async () => {
    render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={false} />)
    const sendBtn = screen.getByLabelText('Enviar mensagem')
    await userEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalled()
  })

  test('does not submit Enter while IME composition is active', () => {
    render(<PanelAssistantComposer value="Hello" onChange={onChange} onSend={onSend} disabled={false} />)
    fireEvent.keyDown(screen.getByLabelText('Campo de mensagem'), {
      key: 'Enter',
      nativeEvent: { isComposing: true },
      isComposing: true,
    })
    expect(onSend).not.toHaveBeenCalled()
  })

  test('enforces the 4000 character input limit', async () => {
    function ControlledComposer() {
      const [value, setValue] = React.useState('x'.repeat(3999))
      return <PanelAssistantComposer value={value} onChange={setValue} onSend={onSend} disabled={false} />
    }
    render(<ControlledComposer />)
    const textarea = screen.getByLabelText('Campo de mensagem') as HTMLTextAreaElement
    await userEvent.type(textarea, 'xx')
    expect(textarea).toHaveValue('x'.repeat(4000))
  })

  test('recalculates textarea height when a controlled value is populated and cleared', () => {
    const { rerender } = render(
      <PanelAssistantComposer value="A quick prompt" onChange={onChange} onSend={onSend} disabled={false} />
    )
    const textarea = screen.getByLabelText('Campo de mensagem') as HTMLTextAreaElement
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 120 })
    rerender(<PanelAssistantComposer value="A quick prompt updated" onChange={onChange} onSend={onSend} disabled={false} />)
    expect(textarea.style.height).toBe('120px')

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 0 })
    rerender(<PanelAssistantComposer value="" onChange={onChange} onSend={onSend} disabled={false} />)
    expect(textarea.style.height).toBe('0px')
  })

  test('keyboard shortcut hint is not displayed in composer', () => {
    // The hint "Enter para enviar..." is in the page, not the composer.
    // The composer itself only renders the textarea and send button.
    render(<PanelAssistantComposer value="" onChange={onChange} onSend={onSend} disabled={false} />)
    expect(screen.queryByText(/Enter para enviar/i)).toBeFalsy()
  })
})
