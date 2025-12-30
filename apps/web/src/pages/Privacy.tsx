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
          <div className="text-base font-semibold">Quais dados podem ser armazenados</div>
          <div className="mt-1 text-sm text-muted-foreground">Exemplos alinhados ao banco de dados do projeto.</div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            - Dados de servidores (guild): ID, nome, ícone, configurações (canais, templates, automoderação, XP, autorole).
          </div>
          <div>
            - Dados operacionais de membros no contexto de uma guild: ID, nome, avatar, data de entrada, contagem de warns.
          </div>
          <div>
            - Logs de moderação: ação, moderador, alvo, motivo/duração e metadados.
          </div>
          <div>
            - Sorteios: configurações, participantes (ID, nome, avatar), vencedores e status.
          </div>
          <div>
            - XP: XP/nível por guild e (quando aplicável) XP global.
          </div>
          <div>
            - Recursos sociais do projeto: perfil (bio), badges, fan arts (url da imagem e metadados), carteira e transações virtuais
            (quando habilitadas).
          </div>
          <div className="text-xs text-muted-foreground">
            Observação: a disponibilidade desses recursos depende de quais módulos você usa/ativa.
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
            - Autenticar usuários e autorizar acesso ao painel.
          </div>
          <div>
            - Aplicar configurações e automatizações (boas-vindas, logs, XP, automoderação, autorole).
          </div>
          <div>
            - Garantir segurança, auditoria e prevenção de abuso (por exemplo: logs de moderação e registros de eventos).
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
            Última atualização: 2025-12-30
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
