import { PageLayout } from '../components/design'
import { Card, CardContent, CardHeader } from '../components/ui'

export default function TermsPage() {
  return (
    <PageLayout title="Termos de Uso" description="Regras e condições para usar a Yue (bot e painel).">
      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Resumo</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Ao usar o painel ou interagir com a Yue no Discord, você concorda com estes Termos.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            A Yue é um bot multifuncional para Discord. O serviço inclui um painel web para configuração de módulos como: recepção de membros, registro de auditoria, níveis de experiência (XP), loja virtual, economia virtual e ferramentas de moderação.
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
            • Você deve estar em conformidade com os Termos do Discord e as regras do servidor em que usa a Yue.
          </div>
          <div>
            • Você é o único responsável pelas configurações de canais, conteúdo de mensagens, itens de loja criados e artes de fãs submetidas.
          </div>
          <div>
            • Você deve ter permissões administrativas ativas para gerenciar comandos, economia e punições diretamente no painel.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Uso permitido</div>
          <div className="mt-1 text-sm text-muted-foreground">O que você pode fazer.</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Você pode usar a Yue para:
          </div>
          <div>
            • Gerenciar e moderar seu servidor com ferramentas automatizadas.
          </div>
          <div>
            • Configurar sistemas de entretenimento, como economia virtual e jogos.
          </div>
          <div>
            • Criar experiências interativas para sua comunidade.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Uso proibido</div>
          <div className="mt-1 text-sm text-muted-foreground">O que não é permitido.</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Você não pode:
          </div>
          <div>
            • Tentar explorar falhas ou burlar limites em jogos de entretenimento virtual.
          </div>
          <div>
            • Usar a Yue para assédio, spam ou coleta de dados pessoais de outros usuários.
          </div>
          <div>
            • Inserir links fraudulentos ou submeter conteúdo maliciosoabusando das ferramentas sociais.
          </div>
          <div>
            • Violar as políticas do Discord ou as leis aplicáveis.
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
            Conteúdo criado por você (mensagens, configurações, textos e templates) permanece sob sua responsabilidade.
          </div>
          <div>
            O painel armazena esses dados para fornecer as funcionalidades solicitadas.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Contato</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Para reportar violações destes Termos ou solicitar informações, entre em contato através do servidor de suporte da Yue no Discord.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Lei aplicável</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Estes Termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida nos tribunais brasileiros.
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
            Última atualização: 30/12/2025
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
