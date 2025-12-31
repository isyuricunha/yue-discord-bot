import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '../lib/cn'
import { Card, CardContent, CardHeader } from '../components/ui'

type nav_item = {
  to: string
  label: string
  description: string
}

const items: nav_item[] = [
  {
    to: '/extras',
    label: 'Início',
    description: 'Visão geral do conteúdo disponível.',
  },
  {
    to: '/extras/sobre',
    label: 'Sobre a Yue',
    description: 'FAQ e como começar.',
  },
  {
    to: '/extras/moderacao',
    label: 'Moderação',
    description: 'Guia de comandos e do módulo.',
  },
  {
    to: '/extras/comandos',
    label: 'Comandos',
    description: 'Lista completa de comandos e exemplos.',
  },
  {
    to: '/extras/placeholders',
    label: 'Placeholders',
    description: 'Variáveis suportadas em mensagens.',
  },
  {
    to: '/extras/apelo-de-ban',
    label: 'Apelo de ban',
    description: 'Regras e como proceder.',
  },
]

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'block rounded-xl border border-border/70 px-4 py-3 transition-colors',
    'hover:border-accent/50 hover:bg-surface/50',
    isActive ? 'bg-surface/60 text-foreground' : 'bg-surface/30 text-muted-foreground'
  )
}

export default function ExtrasPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Extras</div>
        <div className="mt-1 text-sm text-muted-foreground">Guias, FAQs e informações úteis sobre a Yue.</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <div className="text-base font-semibold">Navegação</div>
            <div className="mt-1 text-sm text-muted-foreground">Escolha um tópico para ler.</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={nav_link_class} end={item.to === '/extras'}>
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
              </NavLink>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
