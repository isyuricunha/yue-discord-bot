# Yue Discord Bot (YueBot)

YueBot is a Discord bot + admin panel built as a **pnpm monorepo**. It ships:

- A Discord bot (moderation and community automation)
- A Fastify API (backend for the admin panel)
- A React (Vite) web UI (admin panel)
- A shared Prisma database package used by both bot and API

> This bot are under heavy development and is ready for production use. But, I don't provide any support for custom/others deployments.

The repository also includes a production Docker image that runs **nginx + API + bot** inside a **single container** (supervised by `supervisord`), plus Docker Compose examples for:

- An internal PostgreSQL (self-contained compose)
- An external PostgreSQL (example connection string)

## Project overview

YueBot is designed to be operated with a web admin panel instead of relying only on chat commands. In practice, the bot and the panel share a single PostgreSQL database and a shared Prisma client.

At a high level:

- The **Web UI** authenticates users via Discord OAuth.
- The **API** issues a JWT session stored in an **httpOnly cookie**.
- The **Bot** performs Discord-side actions and exposes a small internal HTTP API for the backend.

## Features (high level)

- Moderation tools and moderation logs
- Server configuration via panel (AutoMod, autorole, etc.)
- Giveaways management (including entries and winner tracking)
- XP / levels (guild and global leaderboards)
- Member listing/details in the panel
- User profile and badges
- Fan art submission and review flows (with allowlists)
- Economy features and coinflip games

## Repository layout

```text
apps/
  api/   (Fastify)
  bot/   (Discord.js)
  web/   (React + Vite)
packages/
  database/ (Prisma client + migrations)
  shared/   (shared utilities/schemas)
```

## Tech stack

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

## What this project provides

### Bot (apps/bot)

Responsibilities:

- Discord moderation and automation
- Scheduled jobs (giveaways, warn expiration, autorole)
- An internal HTTP API used by the backend to perform Discord-context actions

Commands (full list):

Note:

- Many option names are in Portuguese (for example `usuario`, `razao`) because the bot is primarily operated in pt-BR.
- Some commands have a `pt-BR` localized name (for example `/ban` is also available as `/banir`).

#### Moderation

- `/ban` (pt-BR: `/banir`) — Ban a member.
  - Options: `usuario` (required), `razao` (optional), `deletar_mensagens` (optional, 0-7 days)
  - Example: `/ban usuario:@User razao:"spam" deletar_mensagens:1`
- `/kick` (pt-BR: `/expulsar`) — Kick a member.
  - Options: `usuario` (required), `razao` (optional)
  - Example: `/kick usuario:@User razao:"rule violation"`
- `/mute` (pt-BR: `/silenciar`) — Apply a Discord timeout.
  - Options: `usuario` (required), `duracao` (required; `5m`, `2h`, `1d`), `razao` (optional)
  - Example: `/mute usuario:@User duracao:30m razao:"cool down"`
- `/unmute` (pt-BR: `/dessilenciar`) — Remove a timeout.
  - Options: `usuario` (required)
  - Example: `/unmute usuario:@User`
- `/warn` (pt-BR: `/avisar`) — Add a warning.
  - Options: `usuario` (required), `razao` (required)
  - Example: `/warn usuario:@User razao:"caps"`
- `/unwarn` (pt-BR: `/remover-aviso`) — Remove warnings.
  - Options: `usuario` (required), `quantidade` (optional; omit to remove all)
  - Example: `/unwarn usuario:@User quantidade:1`
- `/modlog` — Show moderation history.
  - Options: `usuario` (required), `tipo` (optional: `ban|kick|warn|mute|unmute`), `limite` (optional, 1-25)
  - Example: `/modlog usuario:@User tipo:warn limite:10`
- `/baninfo` — Check if an ID is banned and display ban details.
  - Options: `usuario_id` (required)
  - Example: `/baninfo usuario_id:123456789012345678`

#### Utility

- `/limpar` — Bulk delete messages.
  - Requires: Manage Messages
  - Options: `quantidade` (required, 1-1000), `usuario` (optional), `filtro` (optional: `bots|humans|links|attachments`)
  - Example: `/limpar quantidade:50 filtro:links`
- `/lock` (pt-BR: `/trancar`) — Lock a text channel (deny `SendMessages` for `@everyone`).
  - Requires: Manage Channels
  - Options: `canal` (optional, defaults to current), `razao` (optional)
  - Example: `/lock canal:#general razao:"raid"`
- `/unlock` (pt-BR: `/destrancar`) — Unlock a previously locked channel.
  - Requires: Manage Channels
  - Options: `canal` (optional, defaults to current)
  - Example: `/unlock canal:#general`
- `/painel` — Send the admin panel URL.
  - Example: `/painel`
- `/say` — Make the bot send a message (supports templates and JSON).
  - Requires: Manage Messages
  - Options: `mensagem` (required; plain text or JSON `{ "content": "...", "embeds": [...] }`), `canal` (optional)
  - Example (text): `/say mensagem:"Hello!" canal:#announcements`
  - Example (JSON): `/say mensagem:"{\"content\":\"Hello\"}"`
- `/ticket` — Configure the tickets system.
  - Requires: Manage Server
  - Subcommands:
    - `setup` — Options: `canal` (required), `categoria` (optional), `log` (optional), `cargo_suporte` (optional), `ativar` (optional)
      - Example: `/ticket setup canal:#tickets categoria:"Suporte" log:#logs cargo_suporte:@Suporte ativar:true`
- `/config` — Configure server modules.
  - Requires: Manage Server
  - Subcommand groups:
    - `channels` — Set/clear channels (modlog, welcome, leave, announcement, giveaway)
      - Example: `/config channels modlog canal:#modlog`
    - `templates` — Set/clear templates (welcome, leave, modlog)
      - Example: `/config templates welcome template:"Bem-vindo {user.mention}!"`
    - `automod` — Configure filters (words, links, caps, domains, warn thresholds)
      - Example: `/config automod link ativar:true block_all:false acao:delete`
    - `xp` — Configure XP enablement and parameters
      - Example: `/config xp enabled ativar:true`
- `/reactionroles` — Manage reaction-roles panels.
  - Requires: Manage Server
  - Subcommands: `create`, `list`, `show`, `publish`, `delete`, `add-item`, `remove-item`, `set`, `sync`
  - Example (create): `/reactionroles create name:"Cargos" role:@Cargo mode:multiple enabled:true`
  - Example (publish): `/reactionroles publish panel_id:<id> channel:#cargos`
- `/evento` — Server events and reminders.
  - Requires: Manage Server
  - Subcommands:
    - `criar` — Options: `titulo` (required), `data_hora` (required), `canal` (required), `descricao` (optional)
      - Example: `/evento criar titulo:"Movie Night" data_hora:"2026-01-03 20:00" canal:#anuncios descricao:"Sessão do filme"`
    - `listar` — No options
      - Example: `/evento listar`
    - `cancelar` — Options: `event_id` (required)

#### Giveaways

- `/sorteio` — Manage reaction-based giveaways.
  - Requires: Manage Server
  - Subcommands:
    - `criar` — Options: `titulo`, `descricao`, `vencedores` (1-20), `duracao` (`1h`, `3d`, `1w`), `canal` (optional), `cargo` (optional)
      - Example: `/sorteio criar titulo:"Nitro" descricao:"Good luck" vencedores:1 duracao:3d`
    - `finalizar` — Options: `id`
      - Example: `/sorteio finalizar id:abc123`
    - `reroll` — Options: `id`
      - Example: `/sorteio reroll id:abc123`
- `/sorteio-lista` — Giveaway with item list + preference picking.
  - Requires: Manage Server
  - Options: `titulo`, `descricao`, `itens`, `vencedores` (1-50), `duracao`, `min-escolhas` (optional), `max-escolhas` (optional), `canal` (optional), `cargo-obrigatorio` (optional)
  - Example: `/sorteio-lista titulo:"Skins" descricao:"Escolha" itens:"A,B,C" vencedores:2 duracao:2d`
- `/sorteio-wizard` — Step-by-step giveaway assistant.
  - Requires: Manage Server
  - Example: `/sorteio-wizard`

#### XP / Levels

- `/rank` — Show XP rank.
  - Options: `global` (optional), `usuario` (optional)
  - Example: `/rank usuario:@User`
- `/leaderboard` — Show XP top list.
  - Options: `global` (optional), `limite` (optional, 1-25)
  - Example: `/leaderboard limite:10`

#### Profile / Badges

- `/profile` (pt-BR: `/perfil`) — Show a user's profile and visible badges.
  - Options: `usuario` (optional)
  - Example: `/profile usuario:@User`
- `/badges` — List and manage badges.
  - Subcommands:
    - `list` (pt-BR: `listar`) — Options: `usuario` (optional)
      - Example: `/badges list usuario:@User`
    - `grant` (pt-BR: `conceder`) — Admin-only. Options: `usuario` (required), `badge` (required)
      - Example: `/badges grant usuario:@User badge:early_supporter`
    - `revoke` (pt-BR: `remover`) — Admin-only. Options: `usuario` (required), `badge` (required)
      - Example: `/badges revoke usuario:@User badge:early_supporter`
    - `holders` — Admin-only. Options: `badge` (required), `limite` (optional), `offset` (optional)
      - Example: `/badges holders badge:early_supporter limite:10 offset:0`

#### Fan art

- `/fanart` — Submit and review fan arts.
  - Subcommands:
    - `submit` (pt-BR: `enviar`) — Options: `imagem` (required), `titulo` (optional), `descricao` (optional), `tags` (optional)
      - Example: `/fanart submit imagem:<upload> titulo:"my art" tags:"yue,fanart"`
    - `review` (pt-BR: `revisar`) — Reviewer-only. Options: `id` (required), `status` (required: `approved|rejected`), `nota` (optional)
      - Example: `/fanart review id:fa_123 status:approved nota:"great"`

#### Economy (luazinhas)

- `/luazinhas` — Balance and transfers.
  - Subcommands:
    - `saldo` — Options: `usuario` (optional)
      - Example: `/luazinhas saldo`
    - `transferir` — Options: `usuario` (required), `quantia` (required), `motivo` (optional)
      - Example: `/luazinhas transferir usuario:@User quantia:100 motivo:"gift"`
    - `admin_add` — Owner-only. Options: `usuario` (required), `quantia` (required), `motivo` (optional)
    - `admin_remove` — Owner-only. Options: `usuario` (required), `quantia` (required), `motivo` (optional)

#### Games (coinflip)

- `/coinflip` — Heads or tails.
  - Subcommands:
    - `flip` — No options.
      - Example: `/coinflip flip`
    - `bet` — Options: `usuario` (required), `quantia` (required), `lado` (required: `heads|tails`)
      - Example: `/coinflip bet usuario:@User quantia:250 lado:heads`
    - `stats` — Options: `usuario` (optional)
      - Example: `/coinflip stats usuario:@User`
    - `info` — No options.

#### Waifu / Husbando / Marriage system

- `/waifu` — Roll a waifu (claim via the button).
- `/husbando` — Roll a husbando (claim via the button).
- `/casar` — Roll a character (claim via the button).
  - Options: `genero` (optional: `any|female|male`)
  - Example: `/casar genero:female`
- `/marry` — Alias of `/casar` (same options).
- `/reroll` — Reroll your last roll in the current channel (cooldown applies).
- `/meuharem` — Show your harem.
  - Options: `pagina` (optional)
  - Example: `/meuharem pagina:2`
- `/harem` — Alias of `/meuharem`.
- `/divorciar` — Divorce a character from your harem.
  - Options: `nome` (required)
  - Example: `/divorciar nome:"Asuna"`
- `/divorce` — Alias of `/divorciar`.
- `/infocasamento` — Show character info and who owns it in the server.
  - Options: `nome` (required)
- `/desejos` — Wishlist management.
  - Subcommands: `adicionar`, `remover`, `listar`
  - Example: `/desejos adicionar nome:"Asuna"`
- `/wishlist` — Alias of `/desejos`.
- `/waifupontos` — Points system.
  - Subcommands: `meu`, `rank` (option: `pagina`)

#### Authenticated messages (verification)

- `/verificarmensagem` — Verify an authenticated message image.
  - Subcommands:
    - `url` — Options: `url` (required), `json` (optional)
    - `arquivo` — Options: `arquivo` (required), `json` (optional)

#### Context menu (right click a message)

Available under `Apps` on the message context menu:

- `Salvar mensagem (Enviar aqui)` — Generates a signed image of the message and replies in the channel.
- `Salvar mensagem (Enviar na DM)` — Generates a signed image of the message and sends it to your DM.

#### Anime (AniList)

- `/anime` — Search and recommendations.
  - Subcommands:
    - `search` (pt-BR: `buscar`) — Options: `titulo` (required), `tipo` (optional: `anime|manga`)
      - Example: `/anime search titulo:"Fullmetal Alchemist" tipo:anime`
    - `trending` — Options: `tipo` (optional: `anime|manga`), `quantidade` (optional, 1-10)
      - Example: `/anime trending tipo:anime quantidade:5`
    - `recommend` (pt-BR: `recomendar`) — Options: `genero` (required), `tipo` (optional), `quantidade` (optional, 1-10)
      - Example: `/anime recommend genero:"Romance" tipo:anime quantidade:10`
  - Subcommand group `watchlist`:
    - `add`/`remove`/`list` — Manage user watchlist
      - Example: `/anime watchlist add titulo:"Frieren" tipo:anime`
    - `dm` — Enable/disable reminders by DM
      - Example: `/anime watchlist dm ativar:true`
    - `channel-set`/`channel-clear` — Configure reminder channel for the current guild

#### Shop / Inventory

- `/loja` — Shop items using luazinhas.
  - Subcommands:
    - `listar` — No options
      - Example: `/loja listar`
    - `comprar` — Options: `item_id` (required), `quantidade` (optional), `motivo` (optional)
      - Example: `/loja comprar item_id:<id> quantidade:1 motivo:"boost"`
    - `admin_criar` — Admin-only. Create/enable shop items
- `/inventario` — Manage inventory items.
  - Subcommands:
    - `listar` — No options
      - Example: `/inventario listar`
    - `usar` — Options: `item_id` (required)
      - Example: `/inventario usar item_id:<id>`

Bot internal API (used by the backend):

- Auth: `Authorization: Bearer ${INTERNAL_API_SECRET}`
- Endpoints:
  - `GET /internal/health`
  - `GET /internal/guilds/:guildId/channels`
  - `GET /internal/guilds/:guildId/roles`
  - `GET /internal/guilds/:guildId/members`
  - `POST /internal/guilds/:guildId/channels/:channelId/messages` (JSON body: `{ "content": "..." }`)

### API (apps/api)

Responsibilities:

- Discord OAuth authentication
- Session cookie auth (`yuebot_token`)
- Admin panel endpoints
- Database access (Prisma)
- Integration with the bot through the internal bot API (HTTP)

Endpoints (high level):

- **Health**
  - `GET /health`
- **Auth** (`/api/auth`)
  - `GET /login`
  - `GET /callback`
  - `GET /me`
  - `POST /refresh`
  - `POST /logout`
- **Guild management** (`/api/guilds`)
  - list accessible guilds
  - read/update guild configuration
  - send message (via bot internal API)
  - moderation logs
  - autorole config
  - xp config, leaderboard and reset
  - channels/roles lookups (via bot internal API)
- **Global XP** (`/api/xp`)
  - `GET /global-me`
  - `GET /global-leaderboard`
  - `POST /global-reset` (restricted via allowlist)
- **Giveaways**
  - create/list/details/cancel
  - manage entries (including disqualify)
- **Stats / Export / Members / Profile / Badges / Fan arts**
  - endpoints used by the panel for stats, exports, members, profiles, badge management and fan art review

### Web UI (apps/web)

React + Vite admin panel, including pages for:

- Dashboard / overview
- Guild settings
- AutoMod
- Autorole
- Moderation logs
- Members
- XP/Levels
- Giveaways
- Badges
- Fan arts
- Login (Discord OAuth)

### Shared package (packages/shared)

The shared package contains utilities and shared schemas used by both API and bot.

It also provides the env loader used across the repo:

- Loads a root `.env` file (if present)
- Optionally loads `.env.local` and overrides values

### Database (packages/database)

Prisma + PostgreSQL.

The schema covers guild configuration, moderation logs, giveaways, XP (guild + global), autorole, profiles/badges/fan arts, and economy/coinflip.

## Security model (high level)

- The panel authenticates primarily via an **httpOnly cookie** (`yuebot_token`).
- CORS is **allowlist-based**.
- State-changing requests authenticated by cookie enforce `Origin` checks to mitigate CSRF when needed.
- Production error responses avoid exposing validation details.

### Security best practices

- Treat all of these as secrets: `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `JWT_SECRET`, `INTERNAL_API_SECRET`, database credentials.
- Never commit secrets to git. Use `.env` / `.env.local` (already gitignored) or a secret manager in production.
- Use long random values (32+ chars) for `JWT_SECRET` and `INTERNAL_API_SECRET` and rotate them if they leak.
- Restrict internal services:
  - Prefer running the internal bot API on the same private network as the API (Docker network / localhost).
  - Do not expose the bot internal API to the public internet.
- Use least privilege:
  - Keep allowlists (`OWNER_USER_IDS`, `FAN_ART_REVIEWER_USER_IDS`, etc.) as small as possible.
  - Run the bot with only the Discord permissions it needs.
- Use HTTPS in production:
  - Set `COOKIE_SECURE=true` when serving over HTTPS, especially if using `SameSite=None`.
  - Keep `CORS_ORIGINS` strict and avoid `*`.

## Production deployment notes

When deploying behind a reverse proxy or on a public domain:

- Set `TRUST_PROXY=1` if the API is behind a proxy/load balancer.
- Set `WEB_URL` (or `FRONTEND_URL`) and `DISCORD_REDIRECT_URI` to your real domain.
- Configure `CORS_ORIGINS` to include your panel origin.
- Cookies:
  - If your panel is served on a different domain and you need `SameSite=None`, you must set `COOKIE_SECURE=true` (browser requirement).
  - Consider setting `COOKIE_DOMAIN` if you want the cookie shared across subdomains.

## Environment variables

The project validates required environment variables at startup.

### Required (production)

API/Bot:

- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `JWT_SECRET` (at least 32 characters)
- `INTERNAL_API_SECRET`

Bot token:

- `DISCORD_TOKEN` or `DISCORD_BOT_TOKEN`

Discord OAuth:

- `DISCORD_REDIRECT_URI` must match the callback route on the API: `/api/auth/callback`.
- OAuth scopes used by the API are `identify` and `guilds`.

Frontend runtime (Docker):

- `VITE_API_URL`
- `VITE_DISCORD_CLIENT_ID`

### Recommended

- `CORS_ORIGINS` (comma-separated allowlist)
- `WEB_URL` and/or `FRONTEND_URL`
- `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`

### Optional

- `ENABLE_BOT` (set to `false` to run only nginx + API)
- `INTERNAL_API_CACHE_TTL_MS`, `INTERNAL_API_CACHE_MAX_ENTRIES`
- Admin allowlists (comma-separated)
  - `BADGE_ADMIN_USER_IDS`
  - `FAN_ART_REVIEWER_USER_IDS`
  - `OWNER_USER_IDS`
  - `GLOBAL_XP_RESET_USER_IDS`

## Local development

### Requirements

- Node.js 24+
- pnpm 10+
- PostgreSQL (local or remote)
- A Discord application (bot token + OAuth client id/secret)

### Discord application setup (summary)

In the Discord Developer Portal:

- Create an application and a bot user.
- Copy `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
- Create/copy a bot token (`DISCORD_TOKEN` or `DISCORD_BOT_TOKEN`).
- Configure the OAuth redirect URL to match your API callback.
  - Local development example: `http://localhost:3000/api/auth/callback`
  - Docker (nginx in front) example: `http://localhost/api/auth/callback`

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment variables

The backend (API/bot/Prisma scripts) loads a root `.env`:

```bash
cp .env.example .env
```

Optionally, use `.env.local` to override values without editing `.env`:

```bash
cp .env.local.example .env.local
```

The frontend is a Vite app, and in dev mode it reads env vars from `apps/web`:

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

### 4) Run dev servers

```bash
pnpm dev

pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

Default URLs:

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Docker

### How the production image works

The Docker image contains:

- nginx serving the `apps/web` build and proxying `/api` to the API
- Fastify API
- Discord bot

At startup, the entrypoint:

- validates `DATABASE_URL`
- waits for PostgreSQL
- runs `prisma migrate deploy`
- injects frontend runtime configuration to `/env.js` (read via `window.__ENV__`)

### Frontend runtime configuration (`/env.js`)

In Docker, the Web UI reads runtime configuration from `window.__ENV__` loaded from `/env.js`.

- `VITE_API_URL` is injected to `window.__ENV__.apiUrl`.
  - Set it to an empty string (`""`) to use same-origin requests (recommended when nginx is proxying `/api`).
- `VITE_DISCORD_CLIENT_ID` is injected to `window.__ENV__.discordClientId`.

Relevant files:

- `Dockerfile`
- `nginx.conf`
- `docker-entrypoint.sh`
- `inject-env.sh`
- `supervisord.conf`

### Registries

- Docker Hub: `isyuricunha/yue-discord-bot`
- GHCR: `ghcr.io/isyuricunha/yue-discord-bot`

## Docker Compose

This repository includes four compose examples (all variables are declared in the YAML files):

- `docker-compose.dockerhub.internal-db.yml`
- `docker-compose.ghcr.internal-db.yml`
- `docker-compose.dockerhub.external-db.yml`
- `docker-compose.ghcr.external-db.yml`

### Internal DB (PostgreSQL inside compose)

Docker Hub:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

GHCR:

```bash
docker compose -f docker-compose.ghcr.internal-db.yml up -d --build
```

By default, ports are mapped as:

- Web/nginx: host `80` -> container `80`
- API: host `3000` -> container `3000`

Override host ports (example):

```bash
HOST_WEB_PORT=8080 HOST_API_PORT=3001 \
  docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

Run only nginx + API (skip the Discord bot):

```bash
ENABLE_BOT=false \
  docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

### External DB (example)

Docker Hub:

```bash
docker compose -f docker-compose.dockerhub.external-db.yml up -d --build
```

GHCR:

```bash
docker compose -f docker-compose.ghcr.external-db.yml up -d --build
```

Notes:

- Update `DATABASE_URL` to point to your external PostgreSQL.
- For local HTTP, keep `COOKIE_SAMESITE=lax` and `COOKIE_SECURE=false`.
- If you deploy behind HTTPS and require `SameSite=None`, you must set `COOKIE_SECURE=true`.

## Build and push using docker compose

The compose files include both `build` and `image`, so you can:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml build
docker compose -f docker-compose.dockerhub.internal-db.yml push
```

Login requirements:

- Docker Hub: `docker login`
- GHCR: `docker login ghcr.io` (typically requires a token with `write:packages`)

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

Whenever you add or change bot commands, deploy slash commands to Discord:

```bash
pnpm --filter @yuebot/bot deploy-commands
```

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See `LICENSE`.
