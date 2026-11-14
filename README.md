<p align="center">
  <img src="apps/web/public/icon.png" width="150" alt="Yue Bot" />
</p>

<h1 align="center">Yue Discord Bot</h1>

<p align="center">
  A self-hostable Discord bot with a built-in web dashboard: moderation and raid protection, XP and levels, economy, entertainment, music, support plans with automatic role delivery, and optional AI assistance.
</p>

<p align="center">
  <a href="https://github.com/isyuricunha/yue-discord-bot/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/isyuricunha/yue-discord-bot/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node.js 24+" src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ED?logo=docker&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-orange" />
</p>

---

## About

**Yue** started as a Discord bot and grew into a full community management platform. The bot handles everyday Discord interactions while the web dashboard gives server administrators a cleaner way to configure features, inspect activity and manage the community without relying only on commands.

The project is actively used in production and is built as a pnpm monorepo containing the Discord bot, the API, the web panel and shared packages.

> **Self-hosting note:** the source is public, but I do not provide support for custom or third-party deployments.

## Features

Features listed here are implemented in source. The panel ships a command catalog generated straight out of the bot's command builders, so the command list never drifts from the code.

- 🛡️ **Moderation & security** — bans, kicks, mutes, warnings with per-guild thresholds and expiration, mod logs, layered AutoMod (word filter, caps, links, optional AI moderation for text and images), AntiRaid join-rate protection, channel locks, and a honey pot trap channel that auto-bans anyone who posts in it (staff exempt, with an unban button for staff).
- 📊 **XP & community** — message and voice XP, levels, leaderboards, XP transfers, prestige, level roles and level-up messages, profiles, badges, birthdays, autoroles with delayed grants, and member management.
- 🎉 **Giveaways & events** — reaction, standard and list giveaways with entry requirements and role-chance multipliers, polls, scheduled events with reminders, suggestions, tickets and reaction-role panels.
- 💰 **Economy & fun** — luazinhas balance, daily rewards, shop, inventory with timed items, bank with interest, provably fair coinflip, anime search, Pokédex, pets, trivia, waifu/husbando rolls, marriages and wishlists.
- 🎵 **Music** — Lavalink-backed playback (YouTube, Spotify, SoundCloud), queue and playlists, volume and now-playing, and a 24-hour DJ mode with a restore-on-restart default playlist.
- ⭐ **Community tools** — welcome and leave messages, starboard, keyword triggers with GIF/image responses, custom commands, fan art submissions with review flow, authenticated message verification, and free-game notifications.
- ❤️ **Support system** — paid support plans through LivePix with OAuth payments, entitlements, automatic Discord role delivery after confirmed payments, and an optional shared-entitlement bridge with the Vai Brasil! portal (see [Shared Nobre with Vai Brasil!](#shared-nobre-with-vai-brasil)).
- ✨ **Optional smart features** — Discord chat assistant with conversation memory and web search, a Panel AI assistant that can propose and apply settings changes, and AI-powered content moderation. All of them stay off until the related provider keys are configured.

## Web dashboard

The dashboard is one of Yue's main parts. After signing in with Discord, administrators can manage their servers through a modern interface instead of configuring everything through slash commands.

It currently includes areas for moderation, AutoMod, AntiRaid, the honey pot trap channel, audit logs, mod logs, members, giveaways, XP and levels, autoroles, tickets, suggestions, reaction roles, starboard, welcome messages, music, custom commands, keyword triggers, free games, support plans, the Panel AI assistant, a setup wizard, and owner-only tools for global administration and panel configuration.

Slash and context-menu commands are documented inside the panel from that generated catalog (`pnpm --filter @yuebot/bot docs:sync` regenerates it).

## Quick start (Docker Compose)

Yue is published as a multi-architecture image for **linux/amd64** and **linux/arm64** on Docker Hub and GHCR:

```bash
# Docker Hub:
docker pull isyuricunha/yue-discord-bot:latest
# GHCR:
docker pull ghcr.io/isyuricunha/yue-discord-bot:latest
```

The Compose file name encodes both choices: `dockerhub` or `ghcr` for the registry, `internal-db` or `external-db` for the database. Self-hosting with your own PostgreSQL uses one of the `external-db` files, for example `docker-compose.dockerhub.external-db.yml`.

A full stack with an internal PostgreSQL and Redis:

```bash
cp .env.docker.example .env
# Create a Discord application, invite the bot to your server, and authorize the
# sign-in callback URI (DISCORD_REDIRECT_URI, for example https://<panel-host>/api/auth/callback)
# in the application's OAuth2 settings. Then fill in the required values.
docker compose -f docker-compose.dockerhub.internal-db.yml up -d
```

Startup applies pending database migrations automatically before the processes begin.

Check that it came up:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml ps
curl -f http://localhost:3000/ready && echo "API ready"   # API, published on the loopback interface
curl -f http://localhost:80/health && echo "Panel up"     # nginx serving the dashboard
```

The internal-db variants publish the panel on host port 80 (override with `HOST_WEB_PORT`) mapped to nginx inside the container on port 8080, and the API on the loopback interface at `${HOST_API_PORT:-3000}`. The external-db variants map the host port to container port 80, where nothing listens; nginx serves the panel on 8080, so adjust the mapping to target container port 8080 before using them. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for all five Compose variants, required variables and known gotchas.

Optional integrations (Lavalink, LivePix, Mistral, a custom OpenAI-compatible provider, OpenAI moderation) are enabled through environment variables.

### Discord gateway recovery

Yue keeps the bot process alive when Discord temporarily rejects a gateway login. If Discord reports that the session-start limit is exhausted, Yue waits until the reset timestamp provided by Discord plus one second, then retries automatically. Other transient gateway login failures use exponential backoff capped at five minutes. No container restart is required. To inspect the current gateway state in a Docker deployment:

```bash
docker compose -f docker-compose.dockerhub.internal-db.yml logs --timestamps --tail 100 yuebot
```

## Configuration

The full variable reference lives in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The core set required in every deployment:

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` (or `DISCORD_BOT_TOKEN`) | Bot token from the Discord application |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | Application secret, used by the dashboard OAuth sign-in |
| `DATABASE_URL` | PostgreSQL connection string (must match the database credentials you actually set) |
| `REDIS_URL` / `REDIS_PASSWORD` | Redis connection for queues and caches |
| `JWT_SECRET` | Signs dashboard sessions (32+ characters) |
| `INTERNAL_API_SECRET` | Authenticates the API-to-bot internal bridge (32+ characters) |
| `OWNER_USER_IDS` | Discord user IDs with owner access to the panel |

Optional groups: AI assistants (the Discord chat assistant runs with `MISTRAL_API_KEY`, or with `CUSTOM_PROVIDER_BASE_URL` and `CUSTOM_PROVIDER_API_KEY` as an OpenAI-compatible provider; `OPENAI_API_KEY` adds image moderation), music (`LAVALINK_NODES`), payments (`LIVEPIX_*`), the shared Nobre bridge (`VB_SHARED_*`), plus caches, limits and reviewer lists.

## How it works

One container runs three processes under supervisord: nginx serving the React dashboard, the Fastify API, and the Discord bot. The dashboard talks only to the API; every Discord action goes API → bot over an authenticated internal HTTP API. Anything the bot must send to Discord later (giveaway results, free-game announcements, episode notifications, support DMs, role removals) is queued as transactional outbox rows and drained with retries and dedupe, so messages survive restarts and are never sent twice.

PostgreSQL (Prisma) is the source of truth; Redis backs queues, caches and AI conversation memory. More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local development

### Requirements

- Node.js 24+
- pnpm 10+ (the repo pins 12.3.4 via corepack)
- PostgreSQL
- Redis
- A Discord application

```bash
git clone https://github.com/isyuricunha/yue-discord-bot.git
cd yue-discord-bot
cp .env.example .env
pnpm install
pnpm dev
```

`pnpm dev` generates the Prisma client, builds the shared packages, registers slash commands, applies safe migrations and starts all three apps together. You can also run them separately:

```bash
pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

Default development URLs:

- Web panel: `http://localhost:5173`
- API: `http://localhost:3000`

## Project structure

```text
apps/
├── bot/        Discord bot (commands, services, schedulers, sidecar workers)
├── api/        Fastify API and partner routes
└── web/        React dashboard

packages/
├── database/   Prisma schema, client and migrations
├── livepix/    LivePix payments client
└── shared/     Shared types, env helpers and domain logic

deploy/
└── systemd/    Optional legacy sidecar units for the shared Nobre worker

docs/           Architecture, deployment and feature documentation
prompts/        Runtime prompt files for the AI assistants
```

Everything lives in a single pnpm workspace so the bot, API, panel and shared packages can evolve together.

## Useful commands

```bash
pnpm dev          # Run the development workspace
pnpm build        # Build all applications and packages
pnpm lint         # Run lint checks
pnpm type-check   # Run TypeScript checks
pnpm test         # Run tests
pnpm knip         # Dead-code audit
pnpm db:generate  # Generate the Prisma client
pnpm db:migrate   # Run database migrations
pnpm db:studio    # Open Prisma Studio
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, processes, internal API, outbox pattern, schedulers |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Compose variants, environment reference, updates, gotchas |
| [docs/SHARED-NOBRE-VAI-BRASIL.md](docs/SHARED-NOBRE-VAI-BRASIL.md) | The shared Nobre entitlement bridge with Vai Brasil! |
| [docs/ai-system-prompts.md](docs/ai-system-prompts.md) | Configuring the Discord and panel AI assistant identities |

## Limits

- The bot's user-facing strings are Portuguese (no bot-side i18n); the dashboard has its own locale files.
- Music requires at least one reachable Lavalink node.
- AI features (chat assistant, panel assistant, AI moderation) stay off until the corresponding provider keys are set.
- Panel AI conversation history is in memory on the API side and is lost on API restart.
- In production the dashboard and the API are served from the same origin (nginx proxies `/api` to the API).

## Releases

Main releases are cut by semantic-release with Conventional Commits, producing `vX.Y.Z` tags, GitHub releases, and matching `latest` plus versioned multi-arch images on Docker Hub and GHCR. See the [Releases](https://github.com/isyuricunha/yue-discord-bot/releases) page.

## Mirrors

- GitHub (primary): https://github.com/isyuricunha/yue-discord-bot
- GitLab: https://gitlab.com/isyuricunha/yue-discord-bot

## License

Yue Discord Bot is licensed under the **GNU Affero General Public License v3.0**.

See [LICENSE](LICENSE) for the full license text.

## Shared Nobre with Vai Brasil!

Supporters who do not link accounts keep everything independent. The optional Vai Brasil! integration lets the bot and the translation portal share the same Nobre entitlement, preserving existing payments, roles and benefits.

The reconciliation runs inside the bot itself: the support scheduler calls the shared sync every five minutes, and native expirations are processed in the same cycle through the transactional outbox. No second Discord gateway and no restart of the main runtime are involved. A legacy mode with dedicated sidecar units exists in `deploy/systemd/` for deployments that prefer to keep synchronization outside the bot process; setting `VB_SHARED_NOBRE_EXTERNAL_WORKER=1` routes the work to those units instead.

Architecture, activation steps and the API contract are documented in [docs/SHARED-NOBRE-VAI-BRASIL.md](docs/SHARED-NOBRE-VAI-BRASIL.md). Synchronization stays disabled until the integration is configured and validated.
