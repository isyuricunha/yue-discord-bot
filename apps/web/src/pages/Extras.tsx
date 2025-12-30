import { Card, CardContent, CardHeader } from '../components/ui'

export default function ExtrasPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Extras</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Guias, FAQs e informações úteis sobre a Yue.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Bem-vindo</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Esta seção é pública e reúne conteúdo para te ajudar a entender como a Yue funciona e como tirar o máximo proveito do bot.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Em breve você verá aqui:
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm">
              Sobre a Yue (Bot)
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm">
              Moderação
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm">
              Placeholders & variáveis
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm">
              Apelo de ban (informativo)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
