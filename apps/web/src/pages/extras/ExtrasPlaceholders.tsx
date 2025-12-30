import template_placeholders from '@yuebot/shared/template_placeholders'
import type { template_placeholder } from '@yuebot/shared/template_placeholders'

import { Card, CardContent, CardHeader } from '../../components/ui'

function placeholder_list(props: { placeholders: template_placeholder[] }) {
  return (
    <div className="mt-3 space-y-2">
      {props.placeholders.map((p) => (
        <div
          key={p.key}
          className="flex flex-col gap-1 rounded-xl border border-border/70 bg-surface/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="font-mono text-sm text-foreground">{p.token}</div>
          <div className="text-sm text-muted-foreground">{p.description ?? '-'}</div>
        </div>
      ))}
    </div>
  )
}

export default function ExtrasPlaceholdersPage() {
  const mention_token = template_placeholders.all_template_placeholders.find((p) => p.key === '@user')?.token ?? '{@user}'

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Placeholders & variáveis</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Use placeholders para deixar mensagens dinâmicas (ex: mencionar o usuário, mostrar nível, etc.).
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Como usar</div>
          <div className="mt-1 text-sm text-muted-foreground">Coloque o placeholder dentro de chaves na sua mensagem.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
            Exemplo: <span className="font-mono text-foreground">Olá {mention_token}!</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Dica: alguns módulos aceitam múltiplas mensagens — a Yue escolhe uma aleatória em cada evento.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Boas-vindas</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Placeholders comuns para mensagens de entrada e saída.
          </div>
        </CardHeader>
        <CardContent>
          {placeholder_list({ placeholders: template_placeholders.welcome_template_placeholders })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">XP</div>
          <div className="mt-1 text-sm text-muted-foreground">Placeholders para mensagens de level up e experiência.</div>
        </CardHeader>
        <CardContent>
          {placeholder_list({ placeholders: template_placeholders.xp_template_placeholders })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Moderação</div>
          <div className="mt-1 text-sm text-muted-foreground">Placeholders para logs e avisos de punições.</div>
        </CardHeader>
        <CardContent>
          {placeholder_list({ placeholders: template_placeholders.modlog_template_placeholders })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Lista completa</div>
          <div className="mt-1 text-sm text-muted-foreground">Todos os placeholders suportados atualmente.</div>
        </CardHeader>
        <CardContent>
          {placeholder_list({ placeholders: template_placeholders.all_template_placeholders })}
        </CardContent>
      </Card>
    </div>
  )
}
