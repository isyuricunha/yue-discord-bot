import { Card, CardContent, CardHeader } from '../../components/ui'
import type { ReactNode } from 'react'

function section_title(props: { children: string }) {
  return <div className="text-sm font-semibold text-foreground">{props.children}</div>
}

function faq_item(props: { question: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">{props.question}</summary>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">{props.children}</div>
    </details>
  )
}

export default function ExtrasModerationPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Moderação</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Como usar os comandos e como configurar logs e automações.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Visão geral</div>
          <div className="mt-1 text-sm text-muted-foreground">Comandos de moderação e onde configurar no painel.</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            A Yue usa principalmente comandos de barra (slash). No Discord, digite <span className="font-mono text-foreground">/</span>{' '}
            e escolha o comando.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/ban</div>
              <div className="mt-1 text-xs text-muted-foreground">Banir um usuário do servidor.</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/kick</div>
              <div className="mt-1 text-xs text-muted-foreground">Expulsar um usuário do servidor.</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/mute</div>
              <div className="mt-1 text-xs text-muted-foreground">Aplicar timeout com duração (ex: 5m, 2h, 1d).</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/unmute</div>
              <div className="mt-1 text-xs text-muted-foreground">Remover timeout de um usuário.</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/warn</div>
              <div className="mt-1 text-xs text-muted-foreground">Advertir um usuário (com razão obrigatória).</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/unwarn</div>
              <div className="mt-1 text-xs text-muted-foreground">Remover uma advertência (por id/registro).</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 md:col-span-2">
              <div className="text-sm font-medium text-foreground">/modlog</div>
              <div className="mt-1 text-xs text-muted-foreground">Ver histórico de punições de um usuário.</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
            Observação: alguns comandos têm nome localizado em pt-BR (ex: <span className="font-mono text-foreground">/banir</span>,{' '}
            <span className="font-mono text-foreground">/expulsar</span>, <span className="font-mono text-foreground">/silenciar</span>,{' '}
            <span className="font-mono text-foreground">/avisar</span>).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Configuração no painel</div>
          <div className="mt-1 text-sm text-muted-foreground">Ajustes que influenciam o comportamento da moderação.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {section_title({ children: 'Cargo de mute (timeout)' })}
          <div className="text-sm text-muted-foreground">
            No painel da guild, em <span className="font-mono text-foreground">Moderação</span>, você pode definir um cargo para ser sincronizado
            com o estado de timeout do Discord.
          </div>

          {section_title({ children: 'Logs e mensagens' })}
          <div className="text-sm text-muted-foreground">
            Para anunciar punições em um canal, configure os módulos de logs do painel e use os comandos de moderação.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Dúvidas comuns</div>
          <div className="mt-1 text-sm text-muted-foreground">Quando algo não funciona, geralmente é permissão/hierarquia.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {faq_item({
            question: 'Executei /mute ou /ban e deu erro. O que pode ser?',
            children: (
              <>
                <div>
                  Verifique se a Yue tem permissão suficiente (ex: Ban Members / Moderate Members) e se o cargo do bot está acima do cargo do
                  alvo na hierarquia.
                </div>
                <div>
                  Também confirme se você (moderador) tem permissão para aplicar aquela punição.
                </div>
              </>
            ),
          })}

          {faq_item({
            question: 'O usuário continua falando mesmo “mutado”.',
            children: (
              <>
                <div>
                  Se o usuário tem permissões elevadas (ex: Administrador) ou algum cargo acima com permissão de falar, a restrição pode não ter
                  efeito em alguns cenários.
                </div>
                <div>
                  Para timeouts, a moderação é aplicada pelo Discord. Para cargos/locks, revise permissões do canal e sobreposições.
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>
    </div>
  )
}
