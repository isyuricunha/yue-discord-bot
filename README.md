# Yue Discord Bot (YueBot)

This repository contains a **pnpm monorepo** with:

- **Bot** (`discord.js`) for moderation, giveaways and community automation
- **API** (`fastify`) used by the admin panel
- **Web UI** (`react` + `vite`) admin panel
- **Database package** (`prisma`) shared by bot and API

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

- **Node.js**: 24+
- **pnpm**: 10+
- **TypeScript**: 5.9+
- **Prisma**: 7+
- **Fastify**: 5+
- **Discord.js**: 14+
- **React**: 19+
- **Vite**: 7+
- **TailwindCSS**: 4+
- **ESLint**: 9

## Local development

### Requirements

- Node.js 24+
- pnpm 10+
- PostgreSQL (local or remote)
- A Discord application (bot token + OAuth client id/secret)

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment variables

This repo uses a root `.env`.

```bash
cp .env.example .env
```

Optionally, you can create a `.env.local` to override `.env` values locally (the loader reads `.env` first, then `.env.local` and overrides values).

```bash
cp .env.local.example .env.local
```

Important: the Web UI is a Vite app. In dev mode, Vite resolves env variables from the app folder (`apps/web`).

```bash
cp apps/web/.env.example apps/web/.env
```

### 3) Database (Prisma)

```bash
pnpm db:generate

# Development schema sync
pnpm db:push

# Migrations
pnpm db:migrate

# Prisma Studio
pnpm db:studio
```

### 4) Run dev servers

```bash
# Run bot + api + web in parallel
pnpm dev

# Or individually
pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

### 5) Default URLs

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Environment variables overview

The main required variables for a complete setup are:

```env
DATABASE_URL=

DISCORD_TOKEN=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=

JWT_SECRET=
INTERNAL_API_SECRET=

WEB_URL=
API_URL=
FRONTEND_URL=

VITE_API_URL=
VITE_DISCORD_CLIENT_ID=
```

Notes:

- `DISCORD_REDIRECT_URI` must match the API callback route: `/api/auth/callback`.
- `JWT_SECRET` must be **at least 32 characters**.
- In dev mode, the frontend can use `VITE_API_URL=http://localhost:3000`.

## Docker (single-container production)

This repo ships a single container with **nginx + API + bot** (via `supervisord`).
The provided `docker-compose.yml` also includes a **PostgreSQL** service (`db`) for a self-contained setup.

Relevant files:

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf` (proxies `/api` to `localhost:3000`)
- `docker-entrypoint.sh` (waits for DB and runs `prisma migrate deploy`)
- `inject-env.sh` (writes `/usr/share/nginx/html/env.js`)

### 1) Create the Docker env file

```bash
cp .env.docker.example .env.docker
```

Update the following variables in `.env.docker` at minimum:

```env
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
JWT_SECRET=
INTERNAL_API_SECRET=
```

If you want to run only API + web (smoke tests) without a real Discord bot token, set:

```env
ENABLE_BOT=false
```

### 2) Start containers

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f
```

### Port mapping

The compose file maps host ports via:

- `HOST_WEB_PORT` (default `80`) -> container `80`
- `HOST_API_PORT` (default `3000`) -> container `3000`

### Frontend runtime config (`/env.js`)

In Docker, the frontend reads runtime configuration from `window.__ENV__` loaded from `/env.js`.

- `VITE_API_URL` is injected to `window.__ENV__.apiUrl`
  - Set it to an empty string to use **same-origin** requests (recommended behind nginx). In that case, frontend requests will be relative (e.g. `/api/auth/me`).
- `VITE_DISCORD_CLIENT_ID` is injected to `window.__ENV__.discordClientId`

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

Whenever you add or change bot commands, deploy them to Discord:

```bash
pnpm --filter @yuebot/bot deploy-commands
```

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See `LICENSE`.
