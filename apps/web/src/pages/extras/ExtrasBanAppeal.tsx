import { Card, CardContent, CardHeader } from '../../components/ui'

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
          <div className="text-base font-semibold">Em construção</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Esta página será apenas informativa (sem formulário), explicando como proceder e quais casos não são elegíveis.
          </div>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
