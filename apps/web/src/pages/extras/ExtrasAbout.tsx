import { Card, CardContent, CardHeader } from '../../components/ui'
import { getDiscordClientId } from '../../env'
import type { ReactNode } from 'react'

function build_invite_url(client_id: string) {
  const params = new URLSearchParams({
    client_id,
    scope: 'bot applications.commands',
    permissions: '0',
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

function faq_item(props: { question: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">{props.question}</summary>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">{props.children}</div>
    </details>
  )
}

export default function ExtrasAboutPage() {
  const client_id = getDiscordClientId()
  const invite_url = client_id ? build_invite_url(client_id) : null

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Sobre a Yue</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Perguntas frequentes sobre o bot e como começar.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Começando</div>
          <div className="mt-1 text-sm text-muted-foreground">
            A Yue é um bot para Discord com foco em utilidades, personalização e módulos para servidores.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Este site é o painel de gerenciamento. Aqui você configura módulos como Boas-vindas, XP e Logs.
          </div>

          {invite_url ? (
            <a
              href={invite_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-border/80 bg-surface/60 px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/50"
            >
              Adicionar a Yue no meu servidor
            </a>
          ) : (
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
              Link de convite indisponível no momento.
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Para adicionar a Yue, você precisa ter permissão de Administrador ou Gerenciar Servidor no servidor.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">FAQ</div>
          <div className="mt-1 text-sm text-muted-foreground">Respostas rápidas para dúvidas comuns.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {faq_item({
            question: 'Como eu uso o painel da Yue?',
            children: (
              <>
                <div>Faça login com sua conta Discord.</div>
                <div>
                  Após entrar, selecione um servidor e acesse os módulos no menu para configurar as funcionalidades.
                </div>
              </>
            ),
          })}

          {faq_item({
            question: 'Qual é o prefixo da Yue?',
            children: (
              <>
                <div>
                  A Yue prioriza comandos de barra (slash commands). Quando aplicável, comandos e interações ficam
                  disponíveis no menu “/” do Discord.
                </div>
              </>
            ),
          })}

          {faq_item({
            question: 'Onde vejo os placeholders/variáveis para mensagens?',
            children: (
              <>
                <div>
                  Você pode ver a lista na página “Placeholders” aqui em Extras. Os placeholders são padronizados e
                  utilizados nos módulos do painel.
                </div>
              </>
            ),
          })}

          {faq_item({
            question: 'A Yue está mandando mensagens “sozinha”. O que pode ser?',
            children: (
              <>
                <div>
                  Na maioria dos casos, foi algum comando/interação executado por alguém, ou alguma automação
                  configurada no painel.
                </div>
                <div>
                  Se você suspeitar de abuso, revise permissões do bot, canais de logs e, se necessário, remova o bot
                  do servidor.
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>
    </div>
  )
}
