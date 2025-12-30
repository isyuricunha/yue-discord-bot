import template_placeholders from '@yuebot/shared/template_placeholders'

import { Card, CardContent, CardHeader } from '../../components/ui'
import { PlaceholderChips } from '../../components/template_placeholders'

export default function ExtrasPlaceholdersPage() {
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
          <div className="text-base font-semibold">Boas-vindas</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Placeholders comuns para mensagens de entrada e saída.
          </div>
        </CardHeader>
        <CardContent>
          <PlaceholderChips placeholders={template_placeholders.welcome_template_placeholders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">XP</div>
          <div className="mt-1 text-sm text-muted-foreground">Placeholders para mensagens de level up e experiência.</div>
        </CardHeader>
        <CardContent>
          <PlaceholderChips placeholders={template_placeholders.xp_template_placeholders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Moderação</div>
          <div className="mt-1 text-sm text-muted-foreground">Placeholders para logs e avisos de punições.</div>
        </CardHeader>
        <CardContent>
          <PlaceholderChips placeholders={template_placeholders.modlog_template_placeholders} />
        </CardContent>
      </Card>
    </div>
  )
}
