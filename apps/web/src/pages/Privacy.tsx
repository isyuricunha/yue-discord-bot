import { PageLayout } from '../components/design'
import { Card, CardContent, CardHeader } from '../components/ui'

export default function PrivacyPage() {
  return (
    <PageLayout title="Política de Privacidade" description="Transparência sobre dados coletados, uso e retenção.">
      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Resumo</div>
          <div className="mt-1 text-sm text-muted-foreground">
            A Yue trata dados mínimos necessários para operar o bot e o painel.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Ao fazer login, usamos OAuth do Discord para identificar sua conta e listar servidores onde você possui permissão para administrar.
          </div>
          <div>
            O painel armazena configurações e dados operacionais para cumprir as funcionalidades configuradas.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Autenticação (Discord OAuth)</div>
          <div className="mt-1 text-sm text-muted-foreground">Como o login funciona.</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            O login é realizado via Discord OAuth com escocos como <span className="font-mono text-foreground">identify</span> e{' '}
            <span className="font-mono text-foreground">guilds</span>.
          </div>
          <div>
            Após autenticar, um token é emitido e armazenado em cookie <span className="font-mono text-foreground">httpOnly</span> para manter a sessão.
          </div>
          <div>
            Também utilizamos um cookie temporário de estado (<span className="font-mono text-foreground">oauth_state</span>) para proteger contra ataques de CSRF.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Dados coletados</div>
          <div className="mt-1 text-sm text-muted-foreground">O que, como e quando coletamos.</div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            A Yue coleta dados de forma passiva (mensagens em servidores com sistemas ativos) ou ativa (interações com comandos ou uso do painel).
          </div>

          <div className="border-l-2 border-primary/30 pl-3">
            <div className="font-medium text-foreground">1. Dados de Usuário</div>
            <div className="mt-1">ID, nome, avatar e configurações de perfil do Discord.</div>
          </div>

          <div className="border-l-2 border-primary/30 pl-3">
            <div className="font-medium text-foreground">2. Dados de Servidores</div>
            <div className="mt-1">ID, nome, ícone e configurações (canais de recepção, logs, tickets, reaction roles, starboard).</div>
          </div>

          <div className="border-l-2 border-primary/30 pl-3">
            <div className="font-medium text-foreground">3. Dados de Moderação</div>
            <div className="mt-1">Registros de warn, kick, ban e mute. Também: tickets, sugestões e logs de auditoria.</div>
          </div>

          <div className="border-l-2 border-primary/30 pl-3">
            <div className="font-medium text-foreground">4. Dados de Economia e Entretenimento</div>
            <div className="mt-1 space-y-1">
              <div>• Saldo da carteira virtual, histórico de transações e itens do inventário.</div>
              <div>• Cara ou Coroa: jogo de moeda virtual com histórico de vitórias/derrotas.</div>
              <div>• Waifu: sistema de personagens colecionáveis (gacha) com rolagens e listas de desejos.</div>
              <div>• Integração com AniList e artes de fãs.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Finalidades</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Os dados são usados para:
          </div>
          <div>
            • Autenticar usuários e autorizar acesso ao painel.
          </div>
          <div>
            • Aplicar configurações e automatizações (recepção, proteção, autorole, XP).
          </div>
          <div>
            • Manter progresso em jogos e economia virtual.
          </div>
          <div>
            • Garantir segurança e auditoria.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Compartilhamento</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Não vendemos dados pessoais.
          </div>
          <div>
            O serviço interage com o Discord (API) para executar as funcionalidades do bot e realizar login.
          </div>
          <div>
            Dados podem ser processados por provedores de infraestrutura para operar o serviço.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Retenção e exclusão</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Mantemos dados enquanto necessário para fornecer o serviço e cumprir propósitos operacionais.
          </div>
          <div>
            Remover a Yue de um servidor ou desativar módulos interrompe a coleta futura. Dados históricos podem permanecer por um período para segurança e consistência.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Seus direitos</div>
          <div className="mt-1 text-sm text-muted-foreground">Direitos conforme LGPD e GDPR.</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Você tem os seguintes direitos:
          </div>
          <div>
            • <span className="font-medium text-foreground">Acesso</span>: solicitar uma cópia dos seus dados.
          </div>
          <div>
            • <span className="font-medium text-foreground">Correção</span>: solicitar correção de dados incorretos.
          </div>
          <div>
            • <span className="font-medium text-foreground">Exclusão</span>: solicitar a remoção dos seus dados.
          </div>
          <div>
            • <span className="font-medium text-foreground">Portabilidade</span>: solicitar seus dados em formato legível.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Contato</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato através do servidor de suporte da Yue no Discord. Ou via e-mail em yue@yuricunha.com
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Segurança</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Adotamos medidas como cookies httpOnly, validação de origem em requisições autenticadas e controles de acesso.
          </div>
          <div>
            Nenhum sistema é 100% seguro. Recomendamos que você proteja sua conta do Discord e permissões do servidor.
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/20">
        <CardHeader>
          <div className="text-base font-semibold">Atualizações</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Podemos atualizar esta política para refletir mudanças no serviço.
          </div>
          <div>
            Última atualização: 30/12/2025
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
