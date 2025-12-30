import { Card, CardContent, CardHeader } from '../../components/ui'

export default function ExtrasAboutPage() {
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
          <div className="text-base font-semibold">Em construção</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Esta página vai trazer um FAQ completo (adaptado e reescrito para a Yue).
          </div>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
