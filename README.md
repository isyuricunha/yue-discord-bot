# Yue Discord Bot (YueBot)

YueBot is a Discord bot + admin panel built as a **pnpm monorepo**. It ships:

- A Discord bot (moderation and community automation)
- A Fastify API (backend for the admin panel)
- A React (Vite) web UI (admin panel)
- A shared Prisma database package used by both bot and API

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

Commands (high-level overview):

Note: some commands are named in Portuguese (as they reflect the server's primary language), but they are grouped below by purpose.

- **Moderation**
  - `ban`, `kick`, `mute`, `unmute`, `warn`, `unwarn`, `modlog`, `baninfo`
- **Utility**
  - `limpar`, `lock`, `unlock`, `painel`, `say`
- **Giveaways**
  - `giveaway`, `sorteio-wizard`, `sorteio-lista`
- **XP/Levels**
  - `rank`, `leaderboard`
- **Profile**
  - `profile`, `badges`
- **Fan art**
  - `fanart`
- **Economy**
  - `luazinhas`
- **Games**
  - `coinflip`
- **Authenticated (message/context menu)**
  - `verify_message` (slash)
  - `save_message_here`, `save_message_dm` (context menu)

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
