# Vai Brasil! e Yue | Nobre compartilhado

## Objetivo e limites

O membro pode contribuir exclusivamente pelo **site**, exclusivamente pelo **Discord**, ou por ambos. **Vincular as contas é opcional**. Sem vínculo, os dois sistemas continuam independentes e seus pagamentos não são associados por nome, e-mail, avatar ou aproximação. Com o vínculo confirmado pelo Discord OAuth2, um crédito verificado de qualquer plataforma passa a compartilhar um prazo de Nobre.

Esta implantação é deliberadamente **aditiva**, sem apagar ou reescrever os pagamentos e benefícios originais da Yue. Os demais servidores atendidos pelo bot não participam, mesmo que usem o mesmo LivePix. A sincronização só opera no servidor e cargo explicitamente configurados.

## Vínculo seguro

Na área `/conta?section=security`, o usuário encontra **Discord conectado**. A interface consulta `GET /api/v1/discord/status`. Quando o OAuth estiver habilitado, `GET /api/v1/discord/start` exige sessão e e-mail verificado e inicia a autorização `identify` do Discord. O servidor cria um token de estado aleatório de 256 bits, armazena apenas SHA-256 por no máximo dez minutos e o protege com cookie HTTP-only, Secure e SameSite Lax. O callback troca o código por token via API oficial, consulta `GET /users/@me`, consome o estado uma única vez e grava o identificador imutável Discord em `ExternalIdentity`, com índices únicos para impedir identidades repetidas.

`POST /api/v1/discord/unlink` exige sessão verificada e Origin correto. A desvinculação não apaga históricos de pagamento nem os créditos já incorporados ao prazo do site. O bot deixa de utilizar o prazo vindo do site na próxima reconciliação, mas mantém qualquer benefício nativo do Discord ainda vigente. O usuário pode pagar nas plataformas separadamente sem nunca conectar contas.

A vinculação não tem escopos de mensagens, e-mail ou entrada automática em servidores. O bot somente aplica o cargo a quem já estiver no servidor escolhido.

## Crédito e prazo autoritativo

O Vai Brasil! mantém o vencimento compartilhado para contas vinculadas, enquanto a Yue preserva o registro financeiro e o benefício nativo Discord. **Não são duas autorizações financeiras**: cada compra é confirmada no seu provedor de origem. A Yue só envia eventos de pagamentos que ela mesma já marcou como `FULFILLED`. A API do site recebe esses eventos de um serviço autenticado, não de usuários ou webhooks públicos.

Quando ocorre a primeira vinculação, a Yue captura o **tempo ainda restante** do seu benefício nativo e envia o marco `legacy` apenas uma vez. O site acrescenta esse saldo ao prazo atual, em transação. Depois, cada pagamento Discord posterior ao marco é enviado com `guildId`, ID imutável do pagamento, `discordId`, dias adquiridos e instante de conclusão. O site guarda um `SharedNobreCredit` único por origem/ID do pagamento. Reenvios são idempotentes, e pagamentos antigos incorporados ao marco inicial não são somados novamente.

As transações de créditos externos bloqueiam a linha do usuário, assim como a confirmação do checkout do próprio site. Dois pagamentos distintos acrescentam dias na ordem, sem sobrescrever a validade um do outro. Os períodos pré-existentes nas duas plataformas são preservados por soma **dos tempos ainda restantes**, não por soma ingênua dos valores históricos desde o começo da conta.

O endpoint de consulta `GET /api/v1/nobre-bridge/links` retorna apenas pares Discord vinculados e a data do prazo compartilhado. `POST /api/v1/nobre-bridge/credit` só aceita a credencial compartilhada, servidor autorizado, payload tipado, ID válido e chave única de crédito. Nunca confiar em parâmetros do navegador para conceder dias. O canal usa HTTPS, acesso protegido e sem cache.

## Cargo Nobre na Yue

O bot consulta os vínculos a cada cinco minutos e antes do processo nativo de expiração. Com link ativo e prazo compartilhado não vencido, adiciona o cargo ao membro existente do servidor indicado. A implementação mantém `SharedNobreMirror` em banco próprio, sem reescrever os históricos de pagamento nativos do bot. A remoção nativa respeita o prazo compartilhado para evitar tirar um cargo quando o membro renovou pelo site. Quando ambos os prazos expiram, o cargo pode ser removido; quando a vinculação é removida, apenas os benefícios de origem Discord permanecem no bot.

Se o site estiver temporariamente indisponível, a Yue não converte a falha de comunicação em uma remoção em massa: mantém o espelho anterior e tenta novamente. O site também mantém funcionamento dos downloads independente de disponibilidade do bot.

## Configuração e ativação

**Nenhum código é ativado apenas por fazer o deploy.** As opções de segurança permanecem desligadas por padrão:

No site, em ambiente privado:
- `VB_DISCORD_LINK_ENABLED=0` inicialmente;
- `VB_DISCORD_CLIENT_ID` e `VB_DISCORD_CLIENT_SECRET`: credenciais do aplicativo Discord que terá a URI de retorno autorizada;
- `VB_SHARED_NOBRE_ENABLED=0` inicialmente;
- `VB_SHARED_NOBRE_TOKEN`: segredo aleatório com pelo menos 40 caracteres, idêntico no bot;
- `VB_SHARED_NOBRE_GUILD_ID`: servidor Discord beneficiado.

No bot, em ambiente privado:
- `VB_SHARED_NOBRE_ENABLED=0` inicialmente;
- `VB_SHARED_NOBRE_ORIGIN=https://traducao.yuricunha.com`;
- `VB_SHARED_NOBRE_TOKEN`: o mesmo segredo;
- `VB_SHARED_NOBRE_GUILD_ID`: o mesmo servidor;
- `VB_SHARED_NOBRE_ROLE_ID`: ID do cargo de apoiador gerenciável naquele servidor.

Passos de ativação obrigatórios:
1. Confirmar qual servidor da Yue integra o Vai Brasil!, e qual é o cargo Nobre associado aos planos desse servidor.
2. Autorizar no aplicativo Discord a URI exata **`https://traducao.yuricunha.com/api/v1/discord/callback`**.
3. Validar, com conta de teste, OAuth, rejeição de contas Discord já vinculadas, saída da sessão e desvinculação; habilitar o vínculo depois.
4. Preparar uma conciliação inicial **somente leitura** do servidor selecionado. Conferir os prazos pré-existentes e o estado dos pagamentos sem importar em massa por engano.
5. Configurar servidor/cargo e a credencial privada compartilhada, habilitar primeiro o serviço do site, depois o bot, com healthchecks de cada serviço.
6. Testar com usuário de teste vinculado, duas compras simuladas, reenvio de evento, expiração e recuperação após perda de comunicação. Observar o resultado no site e no cargo da Yue sem efetuar cobrança real.
7. Somente depois de verificadas essas condições, ativar a sincronização de membros. Não ativar automaticamente por push ou build.

### Migrações

Site: `20261018143000_shared_nobre_oauth_credits`, enum `DISCORD_LINK` e tabela `SharedNobreCredit`, sem remoção de dados existentes. Bot: `20261018145000_shared_nobre_mirror`, tabela de espelho de cargo, sem modificação nas tabelas financeiras existentes.

### Controles

Qualquer falha de autenticação do serviço bloqueia a API compartilhada. Nenhum cliente web consegue chamar o bridge com credencial de administrador. Não há acesso ao painel da Yue nem aos dados financeiros de outras comunidades. Logs de sincronização não guardam tokens nem payloads de checkout. Segredos não são versionados.

Nenhum servidor ou roleId deve ser adivinhado, copiado de nomes parecidos ou escolhido automaticamente caso existam múltiplas comunidades. Mudanças no vínculo não transferem o direito de pagamento original para outra identidade sem revisão humana.

## Referências oficiais

- [Discord OAuth2, authorization code e proteção de estado](https://discord.com/developers/docs/topics/oauth2)
- [Discord /users/@me com escopo identify](https://discord.com/developers/docs/resources/user)
- [Discord: adicionar/remover cargo de membro existente](https://discord.com/developers/docs/resources/guild)
- [Prisma: transações e isolamento serializável](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)

## Verificação de vinculação real e segurança de cargos

- Uma vinculação OAuth real foi confirmada em produção. A ponte privada retornou um único vínculo, com autenticação obrigatória; na conferência, o portal não possuía créditos importados nem benefícios Nobre ativos. Isso é esperado para uma conta administrativa sem contribuição registrada: acesso administrativo não equivale a pagamento Nobre.
- O Discord confirmou que o cargo é gerenciável e está abaixo do cargo do bot. Nenhum membro ou cargo foi alterado nesse teste.
- A inspeção da rotina de expiração identificou risco de remoção de cargos atribuídos manualmente. A migração **`20261018165000_shared_nobre_role_provenance`** adicionou à base da Yue o campo `roleManagedByBridge` (padrão falso). Somente cargos adicionados pela ponte ou assumidos por ela ao adiar uma remoção nativa podem ser removidos quando o benefício compartilhado terminar. Um cargo administrativo/manual sem histórico gerenciado permanece intocado.
- Os testes específicos de proveniência, a suíte da Yue, TypeScript, lint e build passaram. Uma imagem isolada de pré-ativação foi construída com sucesso enquanto o bot atual permaneceu saudável. Não foi feito restart nem iniciado um segundo cliente Discord.
- A vinculação no site e a ponte privada estão ativas. A sincronização automática da Yue segue desligada no container em execução. Liberá-la requer promoção controlada da imagem e validação de benefícios reais vinculados, sem risco de processamento duplicado do gateway.

## Status de entrega

Vinculação OAuth e ponte de créditos ativas. A importação inicial foi aplicada e um reconciliador REST de execução curta está operacional e agendado a cada cinco minutos, sem criar um segundo gateway e sem reiniciar o bot principal. A chave de ativação do runtime principal continua desligada; a unidade independente é a responsável exclusiva pela sincronização até uma promoção controlada do runtime.

## Evidências da implementação de pré-ativação

- Migração aditiva \`20261018143000_shared_nobre_oauth_credits\` aplicada no banco do portal; migração \`20261018145000_shared_nobre_mirror\` aplicada no banco da Yue. Ambas tiveram status final consistente, sem remoção de dados.
- A única comunidade da Yue com apoio configurado e provedor conectado é Vai Brasil!, e seus planos usam um único cargo. O alvo foi identificado por consulta autenticada apenas para configuração privada; seus IDs não são expostos nem versionados.
- Os quatro planos no Discord foram normalizados para 30 dias/R$ 35, 60 dias/R$ 70, 90 dias/R$ 90 e 180 dias/R$ 180. O plano anterior de 365 dias foi arquivado somente para novas contribuições. Os snapshots de valores e durações dos pagamentos antigos não foram alterados, e a mudança deixou auditoria financeira.
- As credenciais do aplicativo Discord existente e um token compartilhado aleatório estão preparados em configurações privadas (sem exposição nos repositórios). As opções \`VB_DISCORD_LINK_ENABLED\` e \`VB_SHARED_NOBRE_ENABLED\` permanecem desativadas para não permitir sincronização antes da autorização do callback e da troca segura de versão do bot.
- Os testes automatizados do site incluem sessão e e-mail verificados, OAuth2 de uso único, state e cookie, tentativa de desvinculação de outra origem, credenciais desativadas, ingestão de créditos externos, repetição do mesmo pagamento, rejeição de crédito não vinculado e preservação dos saldos já registrados. A Yue também possui testes para preservação de cargo com prazo vinculado e comportamento inalterado quando a ponte está desativada.
- TypeScript, suíte do portal, lint, testes e verificação de tipos da Yue passaram. O teste Chromium do site em 1440, 768, 390 e 320 px confirmou formulário de vínculo desativado, informação sobre vinculação opcional, desvinculação simulada e ausência de overflow horizontal ou exceções.
- O website foi promovido com deploy blue/green e healthchecks sem downtime, com somente duas releases anteriores. O processo da Yue atual permanece disponível com os benefícios nativos existentes. A nova integração do bot está pronta para release em etapa isolada, sem sobrepor a sessão Discord ativa antes da ativação.
- Não foram enviadas mensagens ao Discord, não foi atribuído nenhum cargo real e nenhuma compra ou evento financeiro de teste foi criada. A sincronização ao vivo depende do callback cadastrado no aplicativo Discord e de uma validação de ponta a ponta com conta de teste.

## Execução REST independente (18/10/2026)

A sincronização foi ativada sem reiniciar a sessão principal da Yue. A entrada `apps/bot/src/nobreWorker.ts` usa exclusivamente `Client.rest.setToken`, nunca `Client.login`, para executar `syncSharedNobre`. Uma unidade isolada agenda uma execução curta a cada cinco minutos. O processo exige `VB_SHARED_NOBRE_WORKER_ENABLED=1` em ambiente privado e reutiliza as credenciais configuradas; a instância principal mantém `VB_SHARED_NOBRE_ENABLED=0`.

No instante da ativação: 2 contas vinculadas, 2 marcos de importação inicial, 1 vínculo com direito Nobre válido, 2 espelhos e cargo presente para o beneficiário ativo. Permanecem preservados os 39 registros de pagamentos confirmados no Discord e os oito benefícios nativos vigentes. A execução de integração passou com sessão principal saudável e sem login adicional de Gateway.

As operações do reconciliador são idempotentes. Eventuais falhas por usuário não interrompem os demais, mas tornam a execução parcial malsucedida para os registros operacionais. A aplicação embarcada do bot contém lógica para proteger o cargo na expiração nativa; enquanto ainda não for promovida ao cliente Gateway em uso, existe possibilidade de breve perda temporária do cargo quando um apoio Discord expira, até o próximo ciclo REST. **As unidades implantadas também estão versionadas em `deploy/systemd/` e devem ser mantidas em par. Antes de promover o runtime principal com sincronização ativada, desabilitar o timer REST**. Nunca iniciar duas conexões Gateway do mesmo bot. O worker não substitui nem modifica pagamentos, assinaturas ou moderação da Yue.

## Sincronização Nobre por eventos

As migrações aditivas de outubro de 2026 em ambos os bancos emitem avisos `LISTEN/NOTIFY` somente após o commit. O serviço persistente da Yue recebe sinais dos dois bancos e invoca a reconciliação REST sem abrir Gateway adicional. Pagamentos, revogações e vínculos são processados em poucos segundos em condições normais. O timer de cinco minutos continua como recuperação, e a projeção administrativa é atualizada quando a Yue confirma uma mudança. Unidades versionadas em `deploy/systemd/vb-nobre-live-listener.service` e documentação completa no projeto do portal em `docs/NOBRE-LIVE-EVENTS.md`.

### Validações pós-ativação

Foram confirmadas notificações de ambos os bancos após commit, nenhuma notificação após rollback, atualização automática do cargo por REST, atualização da fotografia administrativa após evento (14 segundos no teste), e integridade de créditos no site. As falhas de subscrição/rede são tratadas com reconexão, inicialização com nova conciliação e timer de cinco minutos. A implementação conserva uma segunda verificação após alterações nativas para evitar corrida com a remoção de cargos do runtime anterior. O único cliente principal Discord permaneceu saudável, sem restart.

## Situação operacional após a promoção da Yue (18/10/2026)

A versão principal da Yue foi promovida com imagem local versionada, após build, testes e verificação da interface/API de uma instância candidata sem Gateway. Na troca da instância principal ocorreu apenas uma reconexão controlada do cliente Discord, sem iniciar duas sessões; os healthchecks finais ficaram saudáveis. O guard de expiração nativa utiliza o espelho compartilhado e permanece ativo na aplicação principal, enquanto o trabalho REST independente continua responsável pelos eventos para evitar reconciliação duplicada.

Para a aplicação principal: `VB_SHARED_NOBRE_ENABLED=1` e `VB_SHARED_NOBRE_EXTERNAL_WORKER=1` no ambiente privado. A unidade `vb-nobre-live-listener.service` recebe sinais confirmados de ambos os bancos, e `vb-nobre-rest-worker.timer` segue como proteção de cinco minutos.

### Expiração no vencimento

A escuta de eventos calcula o menor vencimento futuro nos benefícios vinculados do portal e na comunidade autorizada da Yue e agenda o disparo para esse instante (com pequena folga). Quando a data chega, o reconciliador REST atualiza o espelho/cargo e a rotina `vb-nobre-native-expiry.service` processa expirações nativas pela caixa de saída transacional já existente. Uma mudança de prazo agenda novamente o próximo vencimento. Os agendamentos são reconstruídos ao reiniciar/reconectar; nenhum temporizador em memória é a única garantia de recuperação. A rotina de cinco minutos continua como contingência.

Vencimento preciso aqui significa agendamento automático na data, sujeito a latência do banco, fila de saída, limites da API do Discord e indisponibilidade de rede. Não é garantia de remoção no mesmo milissegundo.

### Evidências e limite da verificação financeira

Na produção, 39 pagamentos históricos da Yue permanecem com estado `FULFILLED`; 8 Nobres nativos permanecem vigentes, 2 marcos `BOT_LEGACY` foram importados e o replay não criou créditos novos. O bot do Discord e seus cargos passaram no smoke test. A API do portal ainda não possui compras pagas próprias. O teste automatizado com confirmação simulada cobriu preço correto, prova de recebimento, negativa por divergência, acumulação e idempotência. Uma consulta independente de pagamento histórico ao provedor retornou HTTP 400; portanto **não declarar concluída** uma nova compra real ponta a ponta pelo portal sem operação financeira autorizada e resposta positiva do provedor.

A imagem anterior e configurações privadas de corte estão preservadas para rollback. Não incluir esses dados nem credenciais em repositórios. A unidade do vencimento nativo foi versionada em `deploy/systemd/vb-nobre-native-expiry.service`.

## Catálogo e checkout compartilhados (19/10/2026)

O painel da Yue é a fonte autoritativa dos planos e valores. O endpoint de parceiro disponibiliza exclusivamente os planos habilitados, não arquivados e ordenados. Ele não expõe cargo, dados privados do painel, credenciais ou pagamentos de outros usuários. O site usa a identidade Discord OAuth vinculada e credencial privada de serviço, jamais aceita um ID Discord fornecido pelo navegador ou um preço enviado pelo cliente. O endpoint exige autenticação Bearer verificada em tempo constante e escopo restrito ao servidor selecionado.

Checkout pelo site grava um único SupportPayment no banco financeiro da Yue, com snapshots imutáveis de plano e custo, conexão OWNER LivePix ativa e cargo validado pelo bot existente. Reutiliza checkouts pendentes conhecidos; transações incertas ficam em CREATING com pendingKey único, bloqueadas para revisão manual, sem reenvio automático ao provedor. O LivePix recebe retorno apenas informativo para a área de Nobre do portal. A confirmação ocorre pela verificação da API oficial e pelo webhook que a Yue já opera; a sincronização de benefícios com o site continua via bridge idempotente, sem segundo webhook e sem segundo saldo financeiro.

A integração privada é servida por um processo API independente, sem cliente gateway Discord, compartilhando apenas a infraestrutura existente e o modelo financeiro. O processo escuta somente dentro do namespace de rede do bot, numa porta alta e fixa, exposto externamente apenas pelo caminho protegido no proxy da Yue. Não se deve iniciar um segundo gateway nem reiniciar o container principal para ativar a integração. O deploy da API de parceiro é reversível desabilitando sua rota e mantendo a Yue original íntegra.

O controle de checkout requer VB_SITE_CHECKOUT_ENABLED=1 em ambos os serviços. Iniciar com o valor desligado, conferir autenticação 401, catálogo de planos, identidade do usuário, logs sem segredos, histórico e testes de pagamento simulados; ativar apenas após todas as checagens. Uma interrupção da Yue bloqueia novos pagamentos no site. Não existe fallback que crie cobrança na base do portal.

Referências: https://docs.livepix.gg/api e https://discord.com/developers/docs/topics/oauth2.

## Reutilização de checkout PENDING e retomada no portal (19/10/2026)

Para uma contribuição PENDING, o link criptografado de checkout é recuperável mesmo após 24 horas, desde que o URL seja HTTPS e pertença exatamente a checkout.livepix.gg. Essa reutilização não cria novo pagamento e preserva a chave pendingKey de unicidade. Os links antigos foram verificados com GET ao LivePix sem efetuar nenhuma transação. O endpoint parceiro de histórico devolve o checkout apenas ao Discord ID consultado pela API autenticada do portal, nunca para pagamentos concluídos/CREATING ou destinos diferentes. Continuam obrigatórios todos os guards existentes de identidade e status. Nunca eliminar arbitrariamente pagamentos pendentes para criar novos checkouts.

## Cargo manual Nobres Vitalícios

A API privada de parceiro expõe POST /api/partner/vai-brasil/lifetime, protegida pela mesma credencial Bearer e escopo da guild. Ela consulta a associação do usuário diretamente pela API oficial Discord usando o bot existente e compara o conjunto de cargos com VB_NOBRE_LIFETIME_ROLE_ID. O identificador foi confirmado pelo nome exato na guild, não informado pelo navegador. A ausência de membro responde lifetime=false; erros de rede e respostas inadequadas devolvem 503. Não altera cargos nem pagamentos LivePix. O portal armazena a projeção validada com TTL de cinco minutos.
