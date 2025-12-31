import { Card, CardContent, CardHeader } from '../../components/ui'
import type { ReactNode } from 'react'

function section_title(props: { children: string }) {
  return <div className="text-sm font-semibold text-foreground">{props.children}</div>
}

function help_box(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <div className="text-sm font-medium text-foreground">{props.title}</div>
      <div className="mt-1 space-y-1 text-sm text-muted-foreground">{props.children}</div>
    </div>
  )
}

function command_item(props: { name: string; description: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
        <span className="font-mono">{props.name}</span>
        <span className="ml-2 text-muted-foreground">— {props.description}</span>
      </summary>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">{props.children}</div>
    </details>
  )
}

function InlineCode(props: { children: string }) {
  return <span className="font-mono text-foreground">{props.children}</span>
}

export default function ExtrasCommandsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Comandos</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Lista completa dos comandos do bot (slash) e interações, com exemplos de uso.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Como usar</div>
          <div className="mt-1 text-sm text-muted-foreground">
            A Yue usa principalmente comandos de barra (slash). No Discord, digite <span className="font-mono text-foreground">/</span> e
            selecione o comando.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {help_box({
            title: 'Dica: nomes em pt-BR e opções em pt-BR',
            children: (
              <>
                <div>
                  Alguns comandos têm <span className="font-mono text-foreground">nome em inglês</span> com{' '}
                  <span className="font-mono text-foreground">localização pt-BR</span> (ex: <InlineCode>{'/ban'}</InlineCode> também aparece
                  como <InlineCode>{'/banir'}</InlineCode> no Discord).
                </div>
                <div>
                  As opções normalmente aparecem em pt-BR (ex: <InlineCode>{'usuario'}</InlineCode>, <InlineCode>{'razao'}</InlineCode>,
                  <InlineCode>{'duracao'}</InlineCode>).
                </div>
              </>
            ),
          })}

          {help_box({
            title: 'Permissões',
            children: (
              <>
                <div>
                  Se um comando falhar, quase sempre é permissão/hierarquia: o bot precisa ter a permissão necessária e o cargo do bot deve estar
                  acima do cargo do alvo.
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Moderação</div>
          <div className="mt-1 text-sm text-muted-foreground">Comandos para punir, registrar e consultar histórico.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/ban (banir)',
            description: 'Banir um usuário do servidor',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'razao'}</InlineCode> (opcional),{' '}
                  <InlineCode>{'deletar_mensagens'}</InlineCode> (opcional, 0-7 dias)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/ban usuario:@Usuario razao:"spam" deletar_mensagens:1'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/kick (expulsar)',
            description: 'Expulsar um usuário do servidor',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'razao'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/kick usuario:@Usuario razao:"regras"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/mute (silenciar)',
            description: 'Aplicar timeout temporário (Discord)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'duracao'}</InlineCode> (obrigatório: 5m, 2h, 1d),{' '}
                  <InlineCode>{'razao'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/mute usuario:@Usuario duracao:30m razao:"cooldown"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/unmute (dessilenciar)',
            description: 'Remover timeout',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/unmute usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/warn (avisar)',
            description: 'Advertir um usuário (warn)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'razao'}</InlineCode> (obrigatório)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/warn usuario:@Usuario razao:"flood"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/unwarn (remover-aviso)',
            description: 'Remover avisos (warns)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'quantidade'}</InlineCode> (opcional; deixe vazio para remover todos)
                </div>
                <div>
                  Exemplo (remover 1): <InlineCode>{'/unwarn usuario:@Usuario quantidade:1'}</InlineCode>
                </div>
                <div>
                  Exemplo (remover todos): <InlineCode>{'/unwarn usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/modlog',
            description: 'Ver histórico de punições de um usuário',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'tipo'}</InlineCode> (opcional: ban/kick/warn/mute/unmute),{' '}
                  <InlineCode>{'limite'}</InlineCode> (opcional, 1-25)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/modlog usuario:@Usuario tipo:warn limite:10'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/baninfo',
            description: 'Ver informações do banimento por ID',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario_id'}</InlineCode> (obrigatório)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/baninfo usuario_id:123456789012345678'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Utilidades</div>
          <div className="mt-1 text-sm text-muted-foreground">Comandos de limpeza, lock e ferramentas administrativas.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/limpar',
            description: 'Limpar mensagens do canal',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'quantidade'}</InlineCode> (obrigatório, 1-1000), <InlineCode>{'usuario'}</InlineCode> (opcional),{' '}
                  <InlineCode>{'filtro'}</InlineCode> (opcional: bots/humans/links/attachments)
                </div>
                <div>
                  Exemplo (links): <InlineCode>{'/limpar quantidade:50 filtro:links'}</InlineCode>
                </div>
                <div>
                  Exemplo (por usuário): <InlineCode>{'/limpar quantidade:100 usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/lock (trancar)',
            description: 'Trancar canal de texto (impede envio de mensagens)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'canal'}</InlineCode> (opcional, padrão: canal atual), <InlineCode>{'razao'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/lock canal:#geral razao:"raid"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/unlock (destrancar)',
            description: 'Destrancar um canal previamente trancado',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'canal'}</InlineCode> (opcional, padrão: canal atual)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/unlock canal:#geral'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/painel',
            description: 'Mostrar o link do painel web',
            children: (
              <>
                <div>
                  Exemplo: <InlineCode>{'/painel'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/say',
            description: 'Enviar uma mensagem em um canal como o bot (com marca d\'água)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'mensagem'}</InlineCode> (obrigatório), <InlineCode>{'canal'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo (texto): <InlineCode>{'/say mensagem:"Olá!" canal:#avisos'}</InlineCode>
                </div>
                <div>
                  Exemplo (JSON):{' '}
                  <InlineCode>{'/say mensagem:"{\\"content\\":\\"Olá\\"}"'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Sorteios</div>
          <div className="mt-1 text-sm text-muted-foreground">Comandos para criar e gerenciar sorteios.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/sorteio',
            description: 'Gerenciar sorteios por reação (subcomandos)',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'criar'}</InlineCode>: título, descrição, vencedores (1-20), duração (1h/3d/1w), canal (opcional), cargo (opcional)
                </div>
                <div>
                  - <InlineCode>{'finalizar'}</InlineCode>: id
                </div>
                <div>
                  - <InlineCode>{'reroll'}</InlineCode>: id
                </div>
                <div>
                  Exemplo: <InlineCode>{'/sorteio criar titulo:"Nitro" descricao:"Boa sorte" vencedores:1 duracao:3d'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/sorteio-lista',
            description: 'Sorteio com lista de itens e preferências',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'titulo'}</InlineCode>, <InlineCode>{'descricao'}</InlineCode>, <InlineCode>{'itens'}</InlineCode> (separados por vírgula),{' '}
                  <InlineCode>{'vencedores'}</InlineCode>, <InlineCode>{'duracao'}</InlineCode>, <InlineCode>{'min-escolhas'}</InlineCode> (opcional),{' '}
                  <InlineCode>{'max-escolhas'}</InlineCode> (opcional), <InlineCode>{'canal'}</InlineCode> (opcional), <InlineCode>{'cargo-obrigatorio'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/sorteio-lista titulo:"Skins" descricao:"Escolha" itens:"A,B,C" vencedores:2 duracao:2d'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/sorteio-wizard',
            description: 'Assistente passo a passo (wizard) para criar sorteios',
            children: (
              <>
                <div>
                  Exemplo: <InlineCode>{'/sorteio-wizard'}</InlineCode>
                </div>
                <div>
                  Observação: o wizard usa menus, botões e modais no Discord.
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">XP / Levels</div>
          <div className="mt-1 text-sm text-muted-foreground">Consulta de rank e leaderboard.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/rank',
            description: 'Ver rank de XP (servidor ou global)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'global'}</InlineCode> (opcional), <InlineCode>{'usuario'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/rank usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/leaderboard',
            description: 'Ver top de XP (servidor ou global)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'global'}</InlineCode> (opcional), <InlineCode>{'limite'}</InlineCode> (opcional, 1-25)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/leaderboard limite:10'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Perfil e badges</div>
          <div className="mt-1 text-sm text-muted-foreground">Comandos para visualizar perfil e gerenciar badges (admins).</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/profile (perfil)',
            description: 'Ver perfil e badges visíveis',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/profile usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/badges',
            description: 'Listar e gerenciar badges',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'list (listar)'}</InlineCode>: listar badges de alguém
                </div>
                <div>
                  - <InlineCode>{'grant (conceder)'}</InlineCode>: admin (conceder)
                </div>
                <div>
                  - <InlineCode>{'revoke (remover)'}</InlineCode>: admin (remover)
                </div>
                <div>
                  - <InlineCode>{'holders'}</InlineCode>: admin (listar holders)
                </div>
                <div>
                  Exemplo (listar): <InlineCode>{'/badges list usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Fan art</div>
          <div className="mt-1 text-sm text-muted-foreground">Fluxo de submissão e revisão.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/fanart',
            description: 'Submeter e moderar fan arts',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'submit (enviar)'}</InlineCode>: enviar imagem + metadados
                </div>
                <div>
                  - <InlineCode>{'review (revisar)'}</InlineCode>: aprovar/rejeitar (reviewers)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/fanart submit imagem:<upload> titulo:"minha arte" tags:"yue,fanart"'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Economia (luazinhas)</div>
          <div className="mt-1 text-sm text-muted-foreground">Saldo, transferências e comandos administrativos.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/luazinhas saldo',
            description: 'Ver saldo de luazinhas',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/luazinhas saldo'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/luazinhas transferir',
            description: 'Transferir luazinhas para alguém',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'quantia'}</InlineCode> (obrigatório), <InlineCode>{'motivo'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/luazinhas transferir usuario:@Usuario quantia:100 motivo:"presente"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/luazinhas admin_add / admin_remove',
            description: 'Adicionar/remover luazinhas (owner)',
            children: (
              <>
                <div>
                  Esses subcomandos são restritos e dependem de allowlist (owners).
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Jogos (coinflip)</div>
          <div className="mt-1 text-sm text-muted-foreground">Cara ou coroa com ou sem aposta.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/coinflip flip',
            description: 'Girar uma moeda sem aposta',
            children: (
              <>
                <div>
                  Exemplo: <InlineCode>{'/coinflip flip'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/coinflip bet',
            description: 'Desafiar alguém para uma aposta',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (obrigatório), <InlineCode>{'quantia'}</InlineCode> (obrigatório),{' '}
                  <InlineCode>{'lado'}</InlineCode> (obrigatório: heads/tails)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/coinflip bet usuario:@Usuario quantia:250 lado:heads'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/coinflip stats',
            description: 'Ver estatísticas',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'usuario'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/coinflip stats usuario:@Usuario'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/coinflip info',
            description: 'Explica como a aleatoriedade funciona (sem “macete”)',
            children: (
              <>
                <div>
                  Exemplo: <InlineCode>{'/coinflip info'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Waifu / casamento (estilo Mudae)</div>
          <div className="mt-1 text-sm text-muted-foreground">Rolls, claim, harem, wishlist e pontos.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {section_title({ children: 'Rolls' })}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/waifu</div>
              <div className="mt-1 text-xs text-muted-foreground">Rolar uma waifu (claim via botão).</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/husbando</div>
              <div className="mt-1 text-xs text-muted-foreground">Rolar um husbando (claim via botão).</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">/casar</div>
              <div className="mt-1 text-xs text-muted-foreground">Rolar personagem (filtro por gênero opcional).</div>
            </div>
          </div>

          {command_item({
            name: '/casar',
            description: 'Rolar um personagem (com filtro opcional)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'genero'}</InlineCode> (opcional: any/female/male)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/casar genero:female'}</InlineCode>
                </div>
                <div>
                  Alias: <InlineCode>{'/marry'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/reroll',
            description: 'Rerolar seu último roll neste canal (cooldown)',
            children: (
              <>
                <div>
                  Exemplo: <InlineCode>{'/reroll'}</InlineCode>
                </div>
              </>
            ),
          })}

          {section_title({ children: 'Harem' })}

          {command_item({
            name: '/meuharem (harem)',
            description: 'Ver seu harem (paginado)',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'pagina'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/meuharem pagina:2'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/divorciar (divorce)',
            description: 'Divorciar de um personagem do seu harem',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'nome'}</InlineCode> (obrigatório)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/divorciar nome:"Asuna"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: '/infocasamento',
            description: 'Buscar informações e ver quem é o dono no servidor',
            children: (
              <>
                <div>
                  Opções: <InlineCode>{'nome'}</InlineCode> (obrigatório)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/infocasamento nome:"Asuna"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {section_title({ children: 'Wishlist' })}

          {command_item({
            name: '/desejos (wishlist)',
            description: 'Gerenciar wishlist (adicionar/remover/listar)',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'adicionar'}</InlineCode>: <InlineCode>{'nome'}</InlineCode>
                </div>
                <div>
                  - <InlineCode>{'remover'}</InlineCode>: <InlineCode>{'nome'}</InlineCode>
                </div>
                <div>
                  - <InlineCode>{'listar'}</InlineCode>: <InlineCode>{'usuario'}</InlineCode> (opcional), <InlineCode>{'pagina'}</InlineCode> (opcional)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/desejos adicionar nome:"Asuna"'}</InlineCode>
                </div>
              </>
            ),
          })}

          {section_title({ children: 'Pontos' })}

          {command_item({
            name: '/waifupontos',
            description: 'Ver pontos e ranking do servidor',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'meu'}</InlineCode>: ver seus pontos
                </div>
                <div>
                  - <InlineCode>{'rank'}</InlineCode>: ver ranking (opção <InlineCode>{'pagina'}</InlineCode>)
                </div>
                <div>
                  Exemplo: <InlineCode>{'/waifupontos rank pagina:1'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-base font-semibold">Mensagens autenticadas</div>
          <div className="mt-1 text-sm text-muted-foreground">Salvar e verificar imagens assinadas de mensagens.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {command_item({
            name: '/verificarmensagem',
            description: 'Verificar se uma imagem de mensagem autenticada é válida',
            children: (
              <>
                <div>
                  Subcomandos:
                </div>
                <div>
                  - <InlineCode>{'url'}</InlineCode>: informar o link da imagem
                </div>
                <div>
                  - <InlineCode>{'arquivo'}</InlineCode>: enviar o arquivo PNG
                </div>
                <div>
                  Exemplo: <InlineCode>{'/verificarmensagem url url:"https://..."'}</InlineCode>
                </div>
              </>
            ),
          })}

          {command_item({
            name: 'Context menu (Apps)',
            description: 'Salvar mensagem em imagem assinada (clique com botão direito)',
            children: (
              <>
                <div>
                  No Discord: clique com o botão direito em uma mensagem → <InlineCode>{'Apps'}</InlineCode>.
                </div>
                <div>
                  Opções disponíveis:
                </div>
                <div>
                  - <InlineCode>{'Salvar mensagem (Enviar aqui)'}</InlineCode>
                </div>
                <div>
                  - <InlineCode>{'Salvar mensagem (Enviar na DM)'}</InlineCode>
                </div>
              </>
            ),
          })}
        </CardContent>
      </Card>
    </div>
  )
}
