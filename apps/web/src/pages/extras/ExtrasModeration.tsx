import { Card, CardContent, CardHeader } from '../../components/ui'

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
          <div className="text-base font-semibold">Em construção</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Esta página vai descrever os comandos essenciais e dicas de configuração.
          </div>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
