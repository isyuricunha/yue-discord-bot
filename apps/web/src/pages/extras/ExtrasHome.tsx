import { NavLink } from 'react-router-dom'

import { Card, CardContent, CardHeader } from '../../components/ui'

type extras_link = {
  to: string
  title: string
  description: string
}

const links: extras_link[] = [
  {
    to: '/extras/sobre',
    title: 'Sobre a Yue',
    description: 'O que é a Yue, como adicionar no servidor e dúvidas comuns.',
  },
  {
    to: '/extras/moderacao',
    title: 'Moderação',
    description: 'Guia rápido dos comandos e do módulo de moderação.',
  },
  {
    to: '/extras/comandos',
    title: 'Comandos',
    description: 'Lista completa de comandos do bot com exemplos.',
  },
  {
    to: '/extras/placeholders',
    title: 'Placeholders & variáveis',
    description: 'Lista de placeholders suportados em mensagens e templates.',
  },
  {
    to: '/extras/apelo-de-ban',
    title: 'Apelo de ban',
    description: 'Informações e regras sobre pedidos de revisão.',
  },
]

export default function ExtrasHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Extras</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Conteúdo público com guias e FAQs sobre a Yue.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {links.map((item) => (
          <NavLink key={item.to} to={item.to} className="block">
            <Card className="h-full transition-colors hover:border-accent/50">
              <CardHeader>
                <div className="text-base font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Abrir</div>
              </CardContent>
            </Card>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
