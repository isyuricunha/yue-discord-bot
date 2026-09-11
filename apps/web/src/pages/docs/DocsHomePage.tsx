import { Link } from 'react-router-dom'
import { catalog } from './docs_shared'
import { command_categories, context_menu_categories } from '../../data/command_categories'

const guides = [
  {
    to: '/docs/guias#xp',
    title: 'XP e níveis',
    description: 'Como ganhar XP conversando, prestígio e transferência entre membros.',
  },
  {
    to: '/docs/guias#economia',
    title: 'Economia (luazinhas)',
    description: 'Recompensa diária, loja, inventário e banco.',
  },
  {
    to: '/docs/guias#musica',
    title: 'Música',
    description: 'Tocar, filas, playlists e comandos de DJ.',
  },
  {
    to: '/docs/guias#sorteios',
    title: 'Sorteios',
    description: 'Do sorteio rápido ao assistente de criação passo a passo.',
  },
  {
    to: '/docs/guias#tickets',
    title: 'Tickets',
    description: 'Atendimento privado entre o membro e a equipe.',
  },
  {
    to: '/docs/guias#waifu',
    title: 'Waifu e casamento',
    description: 'Rolls, desejo, pontos e o sistema de casamento.',
  },
  {
    to: '/docs/guias#moderacao',
    title: 'Moderação',
    description: 'Ban, avisos, mutes, modlog e antiraid.',
  },
  {
    to: '/docs/guias#painel',
    title: 'Painel web e IA',
    description: 'Gerencie o servidor pelo navegador e converse com a IA do painel.',
  },
]

export default function DocsHomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-surface p-6 shadow-innerBorder">
        <h2 className="text-xl font-semibold tracking-tight">O que é a Yue?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A Yue é a assistente do seu servidor: moderação com logs e antiraid, sistema de XP e níveis,
          economia em luazinhas, player de música, sorteios, tickets, waifus e um painel web completo
          com uma IA embutida que entende o seu servidor. Tudo em português, direto no Discord.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-canvas/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo 1</div>
            <div className="mt-1 text-sm">Convide a Yue pro servidor e dê as permissões sugeridas.</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-canvas/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo 2</div>
            <div className="mt-1 text-sm">
              Use <span className="font-mono">/</span> no Discord: todo comando aparece com descrição e
              opções em português.
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-canvas/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo 3</div>
            <div className="mt-1 text-sm">
              Configure tudo pelo <Link to="/login" className="underline underline-offset-4 hover:text-foreground">painel web</Link> ou
              com <span className="font-mono">/config</span>.
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Comandos por categoria</h2>
          <Link to="/docs/comandos" className="text-sm underline underline-offset-4 hover:text-foreground">
            ver todos os {catalog.commands.length} comandos
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {command_categories.map((category) => {
            const count = catalog.commands.filter((command) =>
              category.commands.includes(command.name),
            ).length
            return (
              <Link
                key={category.id}
                to={`/docs/comandos?categoria=${category.id}`}
                className="rounded-2xl border border-border/70 bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{category.label}</div>
                  <div className="text-xs text-muted-foreground">{count} comandos</div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              </Link>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Além dos {catalog.commands.length} slash commands, existem{' '}
          {catalog.contextMenu.length} ações de contexto em mensagens (
          {context_menu_categories.map((category) => category.label.toLowerCase()).join(', ')}).
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Guias</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.to}
              to={guide.to}
              className="rounded-2xl border border-border/70 bg-surface p-4 transition-colors hover:border-accent/40"
            >
              <div className="font-medium">{guide.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
