# Yue Discord Bot (YueBot)

Este repositório é um monorepo (pnpm workspaces) com:

- **Bot**: `discord.js`.
- **API**: `fastify` (back-end do painel).
- **Web UI**: `react` + `vite` (painel de administração).
- **Database package**: `prisma` (cliente + migrations compartilhado pelo bot e pela API).

O projeto também inclui uma imagem Docker de produção em **um único container** (nginx + API + bot via supervisord), e exemplos de Docker Compose para:

- **DB interno** (PostgreSQL dentro do compose)
- **DB externo** (exemplo apontando para um Postgres fora do compose)

## Estrutura do repositório

```text
apps/
  api/   (Fastify)
  bot/   (Discord.js)
  web/   (React + Vite)
packages/
  database/ (Prisma client + migrations)
  shared/   (utilitários/schemas compartilhados)
```

## Stack

- Node.js: 24+
- pnpm: 10+
- TypeScript: 5.9+
- Prisma: 7+
- Fastify: 5+
- Discord.js: 14+
- React: 19+
- Vite: 7+
- TailwindCSS: 4+
- ESLint: 9

## Componentes e responsabilidades

### Bot (apps/bot)

Responsável por:

- Moderação e automação
- Rotinas agendadas (sorteios, expiração de warns, autorole)
- API interna (HTTP) consumida pela API para ações que exigem contexto do Discord

Comandos (visão geral):

- **Moderação**
  - `ban`, `kick`, `mute`, `unmute`, `warn`, `unwarn`, `modlog`, `baninfo`
- **Utilidade**
  - `limpar`, `lock`, `unlock`, `painel`, `say`
- **Sorteios**
  - `giveaway`, `sorteio-wizard`, `sorteio-lista`
- **XP/Levels**
  - `rank`, `leaderboard`
- **Perfil**
  - `profile`, `badges`
- **Fan art**
  - `fanart`
- **Economia**
  - `luazinhas`
- **Jogos**
  - `coinflip`
- **Comandos autenticados (mensagem/context menu)**
  - `verify_message` (slash)
  - `save_message_here`, `save_message_dm` (context menu)

### API (apps/api)

Responsável por:

- Autenticação via Discord OAuth
- Cookie de sessão (`yuebot_token`) e endpoints do painel
- Acesso ao banco (Prisma)
- Integração com o bot via **Internal API** (HTTP) para:
  - listar canais/roles/members
  - enviar mensagem em canal

Endpoints (alto nível):

- **Saúde**
  - `GET /health`
- **Auth** (`/api/auth`)
  - `GET /login`
  - `GET /callback`
  - `GET /me`
  - `POST /refresh`
  - `POST /logout`
- **Guilds e configurações** (`/api/guilds`)
  - listar guilds acessíveis
  - ler/atualizar configuração
  - enviar mensagem
  - modlogs
  - autorole config
  - xp config + leaderboard + reset
  - canais/roles (via internal API do bot)
- **XP global** (`/api/xp`)
  - `GET /global-me`
  - `GET /global-leaderboard`
  - `POST /global-reset` (restrito por allowlist)
- **Sorteios** (`/api/guilds/:guildId/giveaways`)
  - criar/listar/detalhar/cancelar
  - gerenciar entries (inclui disqualify)
- **Stats**
  - `GET /api/guilds/:guildId/stats`
- **Export**
  - export de entries de sorteio
  - export de modlogs
- **Members**
  - listagem e detalhe de membros
  - atualização de notas
- **Profile/Badges/FanArts**
  - endpoints para perfil
  - administração de badges (restrito)
  - submissão e revisão de fan arts (restrito)

### Web UI (apps/web)

Painel web (React + Vite) para gerenciar:

- Overview/Dashboard
- Guild view
- AutoMod
- Autorole
- Mod logs
- Members e detalhes
- XP/Levels
- Giveaways (lista, criação e detalhes)
- Badges
- Fan arts
- Settings
- Login (Discord OAuth)

### Banco de dados (packages/database)

Prisma + Postgres. Modelos principais (visão geral):

- Guild e GuildConfig
- ModLog
- Giveaway, GiveawayEntry, GiveawayWinner
- GuildMember
- XP (GuildXpConfig, GuildXpMember, GlobalXpMember, GuildLevelRoleReward)
- Autorole (GuildAutoroleConfig, GuildAutoroleRole, GuildAutorolePending)
- Perfil/Badges/FanArts
- Economia e coinflip

## Variáveis de ambiente

O projeto valida variáveis obrigatórias em produção. Os arquivos de compose deste repositório já incluem um conjunto completo com valores placeholder.

### Obrigatórias (produção)

API/Bot:

- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `JWT_SECRET` (mínimo 32 caracteres)
- `INTERNAL_API_SECRET`

Frontend (runtime em Docker):

- `VITE_API_URL`
- `VITE_DISCORD_CLIENT_ID`

### Importantes (recomendadas)

- `CORS_ORIGINS` (lista separada por vírgula)
- `WEB_URL` e/ou `FRONTEND_URL`
- `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`

### Opcionais

- `ENABLE_BOT` (defina `false` para subir apenas nginx + API + web)
- `INTERNAL_API_CACHE_TTL_MS`, `INTERNAL_API_CACHE_MAX_ENTRIES`
- Allowlists administrativas (separadas por vírgula)
  - `BADGE_ADMIN_USER_IDS`
  - `FAN_ART_REVIEWER_USER_IDS`
  - `OWNER_USER_IDS`
  - `GLOBAL_XP_RESET_USER_IDS`

## Desenvolvimento local

### Requisitos

- Node.js 24+
- pnpm 10+
- PostgreSQL (local ou remoto)
- Uma aplicação no Discord (bot token + OAuth client id/secret)

### 1) Instalar dependências

```bash
pnpm install
```

### 2) Configurar variáveis

O back-end (API/bot/scripts Prisma) usa `.env` na raiz:

```bash
cp .env.example .env
```

Opcionalmente, use `.env.local` para sobrescrever valores sem mexer no arquivo base:

```bash
cp .env.local.example .env.local
```

O front-end (Vite) usa variáveis no diretório do app:

```bash
cp apps/web/.env.example apps/web/.env
```

### 3) Prisma

```bash
pnpm db:generate

pnpm db:push

pnpm db:migrate

pnpm db:studio
```

### 4) Rodar em modo dev

```bash
pnpm dev

pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

URLs padrão:

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Docker

### Como a imagem funciona

A imagem de produção contém:

- nginx (serve o build do `apps/web` e faz proxy de `/api` para a API)
- API (Fastify)
- Bot (Discord.js)

Na inicialização, o entrypoint:

- verifica `DATABASE_URL`
- aguarda o Postgres ficar pronto
- executa `prisma migrate deploy`
- injeta runtime env para o front-end em `/env.js` (lido via `window.__ENV__`)

### Registries e nomes de imagem

- Docker Hub: `isyuricunha/yue-discord-bot`
- GHCR: `ghcr.io/isyuricunha/yue-discord-bot`

## Docker Compose

Este repositório inclui 4 arquivos de compose, todos com variáveis definidas diretamente no YAML:

- `docker-compose.dockerhub.internal-db.yml`
- `docker-compose.ghcr.internal-db.yml`
- `docker-compose.dockerhub.external-db.yml`
- `docker-compose.ghcr.external-db.yml`

### Compose com DB interno (PostgreSQL no compose)

Docker Hub:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

GHCR:

```bash
docker compose -f docker-compose.ghcr.internal-db.yml up -d --build
```

Por padrão, o compose expõe:

- Porta do web/nginx: host `80` -> container `80`
- Porta da API: host `3000` -> container `3000`

Você pode sobrescrever com variáveis de ambiente:

```bash
HOST_WEB_PORT=8080 HOST_API_PORT=3001 \
  docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

Também é possível subir somente nginx + API (sem iniciar o bot) com:

```bash
ENABLE_BOT=false \
  docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

### Compose com DB externo (exemplo)

Docker Hub:

```bash
docker compose -f docker-compose.dockerhub.external-db.yml up -d --build
```

GHCR:

```bash
docker compose -f docker-compose.ghcr.external-db.yml up -d --build
```

Notas importantes:

- Para DB externo, ajuste `DATABASE_URL` para apontar para o seu Postgres (host, porta, usuário, senha e banco).
- Para HTTP local, mantenha `COOKIE_SAMESITE=lax` e `COOKIE_SECURE=false`.
- Se você publicar atrás de HTTPS e precisar `SameSite=None`, então `COOKIE_SECURE` deve ser `true`.

## Build e push usando docker compose

Os compose acima incluem `build` e `image`. Isso permite:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml build
docker compose -f docker-compose.dockerhub.internal-db.yml push
```

Para Docker Hub, faça login antes:

```bash
docker login
```

Para GHCR, faça login no registry:

```bash
docker login ghcr.io
```

Observações:

- Para publicar no GHCR normalmente é necessário um token com permissão `write:packages`.
- Se você quiser publicar tags específicas (não apenas `latest`), use `docker tag` ou ajuste o `image:` no compose.

## Health checks

- API: `GET /health`
- nginx: `GET /health`

## Scripts

```bash
pnpm lint
pnpm type-check
pnpm build

pnpm dev
pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

## Slash commands

Sempre que adicionar/alterar comandos do bot, publique os slash commands no Discord:

```bash
pnpm --filter @yuebot/bot deploy-commands
```

## Licença

Este projeto usa a licença GNU Affero General Public License v3.0 (AGPL-3.0). Veja `LICENSE`.
