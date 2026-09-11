import * as React from 'react'
import { cn } from '../../lib/cn'
import command_catalog_json from '../../data/commands.generated.json'
import { category_for_command } from '../../data/command_categories'

// ---------- Tipos do catálogo gerado (apps/bot/scripts/export-commands.ts) ----------

type catalog_option = {
  type: number
  name: string
  description: string
  required?: boolean
  min_value?: number
  max_value?: number
  choices?: Array<{ name: string; value: string }>
  options?: catalog_option[]
}

export type catalog_command = {
  name: string
  name_localizations?: Record<string, string> | null
  description: string
  description_localizations?: Record<string, string> | null
  default_member_permissions?: string | null
  dm_permission?: boolean | null
  options?: catalog_option[]
}

export type catalog_data = {
  generatedAt: string
  commands: catalog_command[]
  contextMenu: catalog_command[]
}

export const catalog = command_catalog_json as unknown as catalog_data

// ---------- Metadados de exibição ----------

const OPTION_TYPES: Record<number, string> = {
  1: 'subcomando',
  2: 'grupo de subcomandos',
  3: 'texto',
  4: 'inteiro',
  5: 'sim/não',
  6: 'usuário',
  7: 'canal',
  8: 'cargo',
  9: 'menção',
  10: 'número',
  11: 'anexo',
}

const PERMISSION_BITS: Array<{ bit: bigint; label: string }> = [
  { bit: 1n << 3n, label: 'Administrador' },
  { bit: 1n << 2n, label: 'Banir membros' },
  { bit: 1n << 1n, label: 'Expulsar membros' },
  { bit: 1n << 28n, label: 'Gerenciar mensagens' },
  { bit: 1n << 40n, label: 'Moderar membros' },
  { bit: 1n << 13n, label: 'Gerenciar cargos' },
  { bit: 1n << 16n, label: 'Gerenciar canais' },
]

function permission_labels(bitfield: string | null | undefined): string[] {
  if (!bitfield) return []
  let bits: bigint
  try {
    bits = BigInt(bitfield)
  } catch {
    return []
  }
  const labels: string[] = []
  for (const { bit, label } of PERMISSION_BITS) {
    if ((bits & bit) === bit) labels.push(label)
  }
  return labels
}

function option_type_label(type: number): string {
  return OPTION_TYPES[type] ?? `tipo ${type}`
}

// Exemplo de uso gerado a partir das opções reais do comando.
function usage_example(command: catalog_command, subcommand?: catalog_option): string {
  const parts = [`/${command.name}`]
  if (subcommand) parts.push(subcommand.name)

  const options = subcommand?.options ?? command.options ?? []
  for (const option of options) {
    if (option.type === 1 || option.type === 2) continue
    const sample = sample_value(option)
    parts.push(option.required ? `${option.name}:${sample}` : `[${option.name}:${sample}]`)
  }
  return parts.join(' ')
}

function sample_value(option: catalog_option): string {
  if (option.choices && option.choices.length > 0) return option.choices[0].value
  switch (option.type) {
    case 6:
      return '@membro'
    case 7:
      return '#canal'
    case 8:
      return '@cargo'
    case 4:
    case 10:
      return String(option.min_value ?? 1)
    case 5:
      return 'verdadeiro'
    case 3:
      return `"${option.name}"`
    default:
      return `:${option.name}`
  }
}

function localized_name(command: catalog_command): string | null {
  return command.name_localizations?.['pt-BR'] ?? null
}

// ---------- Componentes ----------

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight">{children}</h2>
}

export function CodeInline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-border/70 bg-surface px-1.5 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  )
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'accent' ? 'border-accent/40 bg-accent/10 text-foreground' : 'border-border/70 bg-surface text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

function OptionsTable({ options }: { options: catalog_option[] }) {
  const visible = options.filter((option) => option.type !== 1 && option.type !== 2)
  if (visible.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Opção</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Obrigatória</th>
            <th className="px-3 py-2 font-medium">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((option) => (
            <tr key={option.name} className="border-t border-border/60 align-top">
              <td className="px-3 py-2 font-mono text-foreground">{option.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{option_type_label(option.type)}</td>
              <td className="px-3 py-2 text-muted-foreground">{option.required ? 'sim' : 'não'}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {option.description}
                {option.choices && option.choices.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {option.choices.map((choice) => (
                      <Badge key={choice.value}>{choice.name}</Badge>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubcommandBlock({ command, subcommand }: { command: catalog_command; subcommand: catalog_option }) {
  return (
    <div className="rounded-xl border border-border/70 bg-canvas/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CodeInline>{`/${command.name} ${subcommand.name}`}</CodeInline>
        <span className="text-xs text-muted-foreground">{subcommand.description}</span>
      </div>
      <div className="mt-2 font-mono text-[11px] text-muted-foreground">
        <span className="select-all">{usage_example(command, subcommand)}</span>
      </div>
      <div className="mt-2">
        <OptionsTable options={subcommand.options ?? []} />
      </div>
    </div>
  )
}

export function CommandCard({ command }: { command: catalog_command }) {
  const category = category_for_command(command.name)
  const local_name = localized_name(command)
  const permissions = permission_labels(command.default_member_permissions)
  const subcommands = (command.options ?? []).filter((option) => option.type === 1)

  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4 shadow-innerBorder">
      <div className="flex flex-wrap items-center gap-2">
        <CodeInline>{`/${command.name}`}</CodeInline>
        {local_name && local_name !== command.name && (
          <span className="text-xs text-muted-foreground">(pt-BR: {local_name})</span>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {permissions.map((label) => (
            <Badge key={label} tone="accent">
              {label}
            </Badge>
          ))}
        </span>
      </div>

      <p className="mt-2 text-sm text-foreground/90">{command.description}</p>

      <div className="mt-3 font-mono text-[11px] text-muted-foreground">
        <span className="select-all">{usage_example(command)}</span>
      </div>

      <div className="mt-3 space-y-2">
        <OptionsTable options={command.options ?? []} />
        {subcommands.map((subcommand) => (
          <SubcommandBlock key={subcommand.name} command={command} subcommand={subcommand} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge>{category.label}</Badge>
        {command.dm_permission === false && <Badge>servidor apenas</Badge>}
      </div>
    </div>
  )
}

export function ContextMenuCard({ command }: { command: catalog_command }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4">
      <div className="font-medium text-foreground">{command.name}</div>
      <p className="mt-1 text-sm text-muted-foreground">{command.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Disponível no menu de contexto: clique com o botão direito numa mensagem (ou segure no mobile) e
        procure em <span className="font-medium text-foreground">Aplicativos</span>.
      </p>
    </div>
  )
}


