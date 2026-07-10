import { describe, expect, test, vi } from 'vitest'

import { render, screen } from '@testing-library/react'

import { PanelAssistantEmptyState } from './PanelAssistantEmptyState'

describe('PanelAssistantEmptyState', () => {
  test('renders title and description', () => {
    render(<PanelAssistantEmptyState quickPrompts={[]} />)
    expect(screen.getByText(/Tire dúvidas sobre recursos/i)).toBeTruthy()
  })

  test('renders guild name when provided', () => {
    render(<PanelAssistantEmptyState guildName="Meu Servidor" quickPrompts={[]} />)
    expect(screen.getByText(/Olá, Meu Servidor/i)).toBeTruthy()
  })

  test('renders quick prompts', () => {
    const onClick = vi.fn()
    render(<PanelAssistantEmptyState quickPrompts={[{ label: 'Prompt 1', onClick }]} />)
    expect(screen.getByText('Prompt 1')).toBeTruthy()
  })
})
