import { Card, CardContent, CardHeader } from '../components/ui'

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Política de Privacidade</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Transparência sobre dados coletados, uso e retenção.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Resumo</div>
          <div className="mt-1 text-sm text-muted-foreground">
            A Yue trata dados mínimos necessários para operar o bot e o painel.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Ao fazer login, usamos OAuth do Discord para identificar sua conta e listar servidores onde você possui permissão
            para administrar.
          </div>
          <div>
            O painel armazena configurações e dados operacionais (por exemplo: logs de moderação, dados de sorteios e XP)
            para cumprir as funcionalidades configuradas.
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
            O login é realizado via Discord OAuth com escopos como <span className="font-mono text-foreground">identify</span> e{' '}
            <span className="font-mono text-foreground">guilds</span>.
          </div>
          <div>
            Após autenticar, um token é emitido e armazenado em cookie <span className="font-mono text-foreground">httpOnly</span> (não acessível
            via JavaScript do navegador) para manter a sessão.
          </div>
          <div>
            Também utilizamos um cookie temporário de estado (<span className="font-mono text-foreground">oauth_state</span>) para proteger contra
            ataques de CSRF no fluxo OAuth.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">O que coletamos, como coletamos e quando coletamos</div>
          <div className="mt-1 text-sm text-muted-foreground">Transparência total sobre seu fluxo de dados.</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            A Yue coleta dados de forma passiva (quando mensagens são enviadas em servidores com sistemas ativos) ou de forma ativa (quando você interage com nossos comandos de barra, de contexto ou usa o painel web).
          </div>
          <div className="pt-2 font-medium text-foreground">1. Dados de Usuário e Autenticação</div>
          <div>
            • ID, nome de usuário e avatar do Discord para exibir seu perfil personalizável (bio, insígnias).
          </div>
          <div>
            • Sessões ativas de login e configuração de notificações (por exemplo: alertas na mensagem direta).
          </div>
          
          <div className="pt-2 font-medium text-foreground">2. Dados de Servidores</div>
          <div>
            • ID, nome, ícone e configurações gerais (canais de recepção, logs de moderação, sistemas de tickets, painéis de reação e starboard).
          </div>
          <div>
            • Listagem de quais servidores você administra quando realiza o login no painel.
          </div>

          <div className="pt-2 font-medium text-foreground">3. Dados de Interação e Moderação</div>
          <div>
            • Registros de aviso, expulsão ou punições (logs de moderação) com motivo e validade.
          </div>
          <div>
            • Tickets abertos (motivos de contato via suporte em um servidor), sugestões aprovadas ou rejeitadas e ações de auditoria.
          </div>

          <div className="pt-2 font-medium text-foreground">4. Dados de Economia e Entretenimento</div>
          <div>
            • Saldo da sua carteira virtual, histórico de transações, itens da loja e inventário (itens comprados/expirados).
          </div>
          <div>
            • Resultados do jogo Cara ou Coroa e histórico de vitórias/derrotas nas suas interações com a economia.
          </div>
          <div>
            • Dados do sistema Waifu (personagens reivindicados, histórico de rolagens, lista de desejos e valor acumulado do personagem).
          </div>
          <div>
            • Progresso e histórico de animes (integração com AniList) e artes de fãs submetidas (imagens e metadados).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Finalidades</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Usamos os dados para:
          </div>
          <div>
            • Autenticar usuários e autorizar acesso ao painel.
          </div>
          <div>
            • Aplicar configurações e automatizações (recepção de membros, proteção, autorole e gerenciamento de experiência).
          </div>
          <div>
            • Garantir persistência dos seus itens, inventário, histórico nas interações de economia e personagens reivindicados no gacha.
          </div>
          <div>
            • Garantir segurança, auditoria e prevenção de abuso (por exemplo: logs de moderação e registros de eventos).
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
            Dados podem ser processados por provedores de infraestrutura (por exemplo: hospedagem) para operar o serviço.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Retenção e exclusão</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Mantemos dados enquanto necessário para fornecer o serviço e cumprir propósitos operacionais (ex: auditoria e histórico).
          </div>
          <div>
            Em muitos casos, remover a Yue de um servidor ou desativar módulos interrompe a coleta futura, mas dados históricos podem permanecer
            por um período para segurança e consistência.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Segurança</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Adotamos medidas razoáveis como cookies httpOnly, validação de origem em requisições autenticadas por cookie e controles de acesso.
          </div>
          <div>
            Apesar disso, nenhum sistema é 100% seguro. Recomendamos que você proteja sua conta do Discord e permissões do servidor.
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
    </div>
  )
}
