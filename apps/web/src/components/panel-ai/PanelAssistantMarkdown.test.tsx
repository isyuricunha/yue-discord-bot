import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { PanelAssistantMarkdown } from './PanelAssistantMarkdown'

describe('PanelAssistantMarkdown', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  test('renders inline code as code without a pre block', () => {
    const { container } = render(<PanelAssistantMarkdown>{'Use `pnpm test` now.'}</PanelAssistantMarkdown>)
    expect(container.querySelector('code')).toHaveTextContent('pnpm test')
    expect(container.querySelector('pre')).not.toBeInTheDocument()
  })

  test('renders a fenced language block with exactly one pre and a language label', () => {
    const { container } = render(<PanelAssistantMarkdown>{'```ts\nconst value = 1\n```'}</PanelAssistantMarkdown>)
    expect(container.querySelectorAll('pre')).toHaveLength(1)
    expect(container.querySelector('pre code')).toHaveClass('language-ts')
    expect(screen.getByText('ts')).toBeInTheDocument()
  })

  test('renders a fenced block without language as a block', () => {
    const { container } = render(<PanelAssistantMarkdown>{'```\nplain text\n```'}</PanelAssistantMarkdown>)
    expect(container.querySelectorAll('pre')).toHaveLength(1)
    expect(container.querySelector('pre code')).toHaveTextContent('plain text')
    expect(screen.getByText('Código')).toBeInTheDocument()
  })

  test('each code copy button copies only its fenced block and reports success', async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText)
    render(<PanelAssistantMarkdown>{'```js\nfirst()\n```\n\n```css\n.second {}\n```'}</PanelAssistantMarkdown>)
    const buttons = screen.getAllByRole('button', { name: 'Copiar código' })
    await userEvent.click(buttons[1])
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith('.second {}')
    expect(screen.getByRole('button', { name: 'Código copiado' })).toBeInTheDocument()
  })

  test('reports clipboard failure accessibly', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    render(<PanelAssistantMarkdown>{'```\ncontent\n```'}</PanelAssistantMarkdown>)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar código' }))
    expect(screen.getByRole('button', { name: /Falha ao copiar código/ })).toBeInTheDocument()
  })

  test.each([
    ['/settings', false],
    ['#permissions', false],
    ['mailto:help@example.com', false],
    ['https://example.com', true],
  ])('renders safe link %s with the correct external behavior', (href, external) => {
    render(<PanelAssistantMarkdown>{`[safe](${href})`}</PanelAssistantMarkdown>)
    const link = screen.getByRole('link', { name: 'safe' })
    expect(link).toHaveAttribute('href', href)
    if (external) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    } else {
      expect(link).not.toHaveAttribute('target')
    }
  })

  test.each(['javascript:alert(1)', 'data:text/plain,bad', 'file:///tmp/bad', 'ftp://example.com']) (
    'renders unsafe scheme %s as non-clickable text',
    (href) => {
      render(<PanelAssistantMarkdown>{`[unsafe](${href})`}</PanelAssistantMarkdown>)
      expect(screen.getByText('unsafe')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'unsafe' })).not.toBeInTheDocument()
    }
  )

  test('renders a protocol-relative link as non-clickable text', () => {
    render(<PanelAssistantMarkdown>{'[unsafe](//evil.example)'}</PanelAssistantMarkdown>)
    expect(screen.getByText('unsafe')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'unsafe' })).not.toBeInTheDocument()
  })

  test('renders image alt text without creating an image or retaining a remote source', () => {
    const { container } = render(
      <PanelAssistantMarkdown>{'![Remote chart](https://evil.example/tracker.svg)'}</PanelAssistantMarkdown>
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Imagem omitida: Remote chart')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('evil.example')
    expect(container.innerHTML).not.toContain('src=')
  })

  test.each([
    'data:image/svg+xml,bad',
    'blob:https://example.com/id',
    'file:///tmp/image.png',
    '//evil.example/image.png',
  ])('does not render or retain dangerous image source %s', (src) => {
    const { container } = render(<PanelAssistantMarkdown>{`![Blocked image](${src})`}</PanelAssistantMarkdown>)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(src)
  })

  test('renders GFM tables in their own horizontal scroll wrapper', () => {
    const { container } = render(<PanelAssistantMarkdown>{'| A | B |\n|---|---|\n| 1 | 2 |'}</PanelAssistantMarkdown>)
    expect(container.querySelector('table')?.parentElement).toHaveClass('overflow-x-auto')
  })

  test('does not render raw HTML', () => {
    const { container } = render(<PanelAssistantMarkdown>{'<script>alert(1)</script>'}</PanelAssistantMarkdown>)
    expect(container.querySelector('script')).not.toBeInTheDocument()
  })
})
