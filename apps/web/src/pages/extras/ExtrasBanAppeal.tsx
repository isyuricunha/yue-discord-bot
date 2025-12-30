import { Card, CardContent, CardHeader } from '../../components/ui'
import type { ReactNode } from 'react'

function faq_item(props: { question: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">{props.question}</summary>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">{props.children}</div>
    </details>
  )
}

export default function ExtrasBanAppealPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Apelo de ban</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Informações e regras sobre pedidos de revisão relacionados ao uso da Yue.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">O que é um apelo?</div>
          <div className="mt-1 text-sm text-muted-foreground">Um apelo é um pedido de revisão de uma punição.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Usar a Yue é um privilégio — apelos existem para casos onde faz sentido avaliar contexto, arrependimento e/ou erros.
          </div>
          <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
            Esta página é informativa e não possui formulário.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Regras básicas</div>
          <div className="mt-1 text-sm text-muted-foreground">Para manter o processo justo e eficiente.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
              1) Faça apenas um apelo por punição.
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
              2) Seja objetivo: explique o que aconteceu, por que foi um erro (se for o caso) e o que você fará diferente.
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
              3) Não pressione a equipe e não tente “forçar” resposta.
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
              4) Não peça apelo em lugares aleatórios (ex: chat público). Use o canal oficial indicado pela equipe.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Quando vale a pena apelar?</div>
          <div className="mt-1 text-sm text-muted-foreground">Exemplos típicos onde o apelo faz sentido.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {faq_item({
            question: 'A punição foi injusta ou baseada em informação errada.',
            children: (
              <>
                <div>Envie evidências (prints, logs, IDs) e explique o contexto.</div>
                <div>Quanto mais verificável, melhor.</div>
              </>
            ),
          })}
          {faq_item({
            question: 'Eu errei, entendi e quero uma segunda chance.',
            children: (
              <>
                <div>Seja transparente e descreva como você vai evitar repetir o problema.</div>
                <div>Evite justificativas vagas (“foi sem querer”).</div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Casos geralmente não elegíveis</div>
          <div className="mt-1 text-sm text-muted-foreground">Situações que normalmente resultam em recusa.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {faq_item({
            question: 'Abuso de bugs/exploits, fraude ou tentativa de prejudicar o serviço.',
            children: (
              <>
                <div>Isso inclui tentativas de explorar falhas para ganho próprio ou causar instabilidade.</div>
              </>
            ),
          })}
          {faq_item({
            question: 'Evasão de ban (uso de contas alternativas para contornar punição).',
            children: (
              <>
                <div>
                  Se a equipe identificar tentativa de contorno, a tendência é manter a punição e reduzir a chance de reversão.
                </div>
              </>
            ),
          })}
          {faq_item({
            question: 'Assédio, doxxing ou disseminação de informações pessoais.',
            children: (
              <>
                <div>Motivo grave e, em geral, tratado como permanente.</div>
              </>
            ),
          })}
        </CardContent>
      </Card>
    </div>
  )
}
