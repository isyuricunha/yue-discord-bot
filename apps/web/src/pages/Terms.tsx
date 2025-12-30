import { Card, CardContent, CardHeader } from '../components/ui'

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Termos de Uso</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Regras e condições para usar a Yue (bot e painel).
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Resumo</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Ao usar o painel ou interagir com a Yue no Discord, você concorda com estes Termos.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            A Yue é um bot para Discord, com um painel web para configuração de recursos (por exemplo: boas-vindas, logs, XP,
            automoderação, sorteios e autorole).
          </div>
          <div>
            Estes Termos se aplicam ao uso do bot e do painel, incluindo quaisquer integrações com a plataforma Discord.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Elegibilidade e responsabilidades</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            - Você deve estar em conformidade com os Termos do Discord e as regras do servidor em que usa a Yue.
          </div>
          <div>
            - Você é responsável pelas configurações feitas no painel e pelo conteúdo de mensagens/templates definidos por você.
          </div>
          <div>
            - Você deve ter permissão para gerenciar o servidor ao configurar recursos no painel.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Uso aceitável</div>
          <div className="mt-1 text-sm text-muted-foreground">O que é permitido e o que não é.</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Você concorda em não:
          </div>
          <div>
            - Tentar explorar falhas, burlar limitações, automatizar abuso, ou interferir na operação do serviço.
          </div>
          <div>
            - Usar a Yue para assédio, spam, phishing, divulgação de dados pessoais, ou qualquer violação de políticas do Discord.
          </div>
          <div>
            - Inserir conteúdo malicioso em templates (por exemplo: links fraudulentos) ou usar recursos para enganar membros.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Disponibilidade e mudanças</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            O serviço pode sofrer alterações, interrupções ou descontinuação a qualquer momento.
          </div>
          <div>
            Podemos ajustar recursos, limites e comportamento do bot para melhorar segurança, estabilidade e conformidade.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Conteúdo e propriedade</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Conteúdo criado por você (ex: mensagens, configurações, textos e templates) permanece sob sua responsabilidade.
          </div>
          <div>
            O painel pode armazenar esses dados para fornecer as funcionalidades solicitadas.
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/20">
        <CardHeader>
          <div className="text-base font-semibold">Aviso legal</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Estes Termos não constituem aconselhamento jurídico. Se você tiver dúvidas, procure orientação profissional.
          </div>
          <div>
            Última atualização: 2025-12-30
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
