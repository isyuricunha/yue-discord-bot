import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import catalog from '../../data/commands.generated.json'
import {
  command_categories,
  category_for_command,
  uncategorized,
} from '../../data/command_categories'
import DocsCommandsPage from './DocsCommandsPage'
import DocsGuidesPage from './DocsGuidesPage'
import DocsHomePage from './DocsHomePage'

function render_docs(ui: React.ReactElement, entry = '/docs') {
  return render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)
}

test('every slash command in the catalog is categorized', () => {
  const orphans = catalog.commands
    .map((command) => command.name)
    .filter((name) => category_for_command(name).id === uncategorized.id)

  expect(orphans).toEqual([])
})

test('every category references commands that exist in the catalog', () => {
  const names = new Set(catalog.commands.map((command) => command.name))
  for (const category of command_categories) {
    for (const name of category.commands) {
      expect(names.has(name)).toBe(true)
    }
  }
})

describe('DocsCommandsPage', () => {
  test('renders category sections and command cards', () => {
    render_docs(<DocsCommandsPage />, '/docs/comandos')

    expect(screen.getByText(/de 73 comandos/)).toBeInTheDocument()
    expect(screen.getByText('/ban')).toBeInTheDocument()
    expect(screen.getByText('Banir um usuário do servidor')).toBeInTheDocument()
  })

  test('filters commands by search query', async () => {
    const user = userEvent.setup()
    render_docs(<DocsCommandsPage />, '/docs/comandos')

    await user.type(screen.getByLabelText('Buscar comandos'), 'banir')

    expect(screen.getByText('/ban')).toBeInTheDocument()
    expect(screen.queryByText('/waifu')).not.toBeInTheDocument()
  })

  test('filters by category from the URL', () => {
    render_docs(<DocsCommandsPage />, '/docs/comandos?categoria=musica')

    expect(screen.getByText('/play')).toBeInTheDocument()
    expect(screen.queryByText('/ban')).not.toBeInTheDocument()
  })
})

describe('DocsHomePage', () => {
  test('renders the overview with category cards and guides', () => {
    render_docs(<DocsHomePage />)

    expect(screen.getByText('O que é a Yue?')).toBeInTheDocument()
    expect(screen.getByText(/ver todos os 73 comandos/)).toBeInTheDocument()
    expect(screen.getAllByText('Waifu e casamento').length).toBeGreaterThan(0)
  })
})

describe('DocsGuidesPage', () => {
  test('renders every guide section', () => {
    render_docs(<DocsGuidesPage />)

    for (const title of ['XP e níveis', 'Economia (luazinhas)', 'Música', 'Moderação']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    expect(screen.getByText('/play')).toBeInTheDocument()
  })
})
