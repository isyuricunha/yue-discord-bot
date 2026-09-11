import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  catalog,
  CommandCard,
  ContextMenuCard,
  SectionTitle,
} from './docs_shared'
import {
  category_for_command,
  command_categories,
  context_menu_categories,
  uncategorized,
} from '../../data/command_categories'

export default function DocsCommandsPage() {
  const [search_params, set_search_params] = useSearchParams()
  const [query, set_query] = React.useState('')

  const active_category = search_params.get('categoria') ?? 'todas'
  const normalized_query = query.trim().toLowerCase()

  const filtered = React.useMemo(() => {
    return catalog.commands.filter((command) => {
      const category = category_for_command(command.name)
      if (active_category === 'todas') {
        if (category.id === uncategorized.id && category.commands.length === 0 && !matches(command)) return false
      } else if (category.id !== active_category) {
        return false
      }
      return matches(command)
    })

    function matches(command: (typeof catalog.commands)[number]): boolean {
      if (!normalized_query) return true
      const localized = command.name_localizations?.['pt-BR'] ?? ''
      const haystack = [
        command.name,
        localized,
        command.description,
        ...(command.options ?? []).flatMap((option) => [option.name, option.description]),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized_query)
    }
  }, [active_category, normalized_query])

  const grouped = React.useMemo(() => {
    return command_categories
      .map((category) => ({
        category,
        commands: filtered.filter((command) => category.commands.includes(command.name)),
      }))
      .filter((entry) => entry.commands.length > 0)
  }, [filtered])

  const orphans = filtered.filter((command) => category_for_command(command.name).id === uncategorized.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <SectionTitle>Comandos</SectionTitle>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(event) => set_query(event.target.value)}
            placeholder="Buscar comando, opção ou descrição..."
            aria-label="Buscar comandos"
            className="h-10 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/50"
          />
          <div className="text-xs text-muted-foreground sm:self-center">
            {filtered.length} de {catalog.commands.length} comandos · atualizado em{' '}
            {new Date(catalog.generatedAt).toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={active_category === 'todas'}
            onClick={() => set_search_params({})}
            label={`Todas (${catalog.commands.length})`}
          />
          {command_categories.map((category) => {
            const total = catalog.commands.filter((command) =>
              category.commands.includes(command.name),
            ).length
            if (total === 0) return null
            return (
              <FilterChip
                key={category.id}
                active={active_category === category.id}
                onClick={() => set_search_params({ categoria: category.id })}
                label={`${category.label} (${total})`}
              />
            )
          })}
        </div>
      </div>

      {grouped.length === 0 && orphans.length === 0 && (
        <div className="rounded-2xl border border-border/70 bg-surface p-8 text-center text-sm text-muted-foreground">
          Nenhum comando encontrado para {`"${query}"`}.
        </div>
      )}

      {grouped.map(({ category, commands }) => (
        <section key={category.id} className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">{category.label}</h3>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
          <div className="grid gap-3">
            {commands.map((command) => (
              <CommandCard key={command.name} command={command} />
            ))}
          </div>
        </section>
      ))}

      {orphans.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">{uncategorized.label}</h3>
          <div className="grid gap-3">
            {orphans.map((command) => (
              <CommandCard key={command.name} command={command} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Ações em mensagens (context menu)</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Não são comandos de barra: clique com o botão direito numa mensagem (ou segure no celular) e
          abra o menu <span className="font-medium text-foreground">Aplicativos</span>.
        </p>
        {context_menu_categories.map((category) => (
          <div key={category.label} className="grid gap-3 sm:grid-cols-2">
            {catalog.contextMenu
              .filter((command) => category.commands.includes(command.name))
              .map((command) => (
                <ContextMenuCard key={command.name} command={command} />
              ))}
          </div>
        ))}
      </section>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-xs transition-colors ' +
        (active
          ? 'border-accent/50 bg-accent/10 font-medium text-foreground'
          : 'border-border/70 bg-surface text-muted-foreground hover:text-foreground')
      }
    >
      {label}
    </button>
  )
}
