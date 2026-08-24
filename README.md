<p align="center">
  <img src="apps/web/public/icon.png" width="150" alt="Yue Bot" />
</p>

<h1 align="center">Yue Discord Bot</h1>

<p align="center">
  A multifunctional Discord bot with a complete web dashboard for managing communities, moderation, entertainment and automation.
</p>

<p align="center">
  <a href="https://github.com/isyuricunha/yue-discord-bot/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/isyuricunha/yue-discord-bot/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node.js 24+" src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ED?logo=docker&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-orange" />
</p>

---

## About

**Yue** started as a Discord bot and grew into a full community management platform.

The bot handles everyday Discord interactions while the web dashboard gives server administrators a cleaner way to configure features, inspect activity and manage the community without relying only on commands.

The project is actively used in production and is built as a monorepo containing the Discord bot, API, web panel and shared packages.

> **Self-hosting note:** the source is public, but I do not provide support for custom or third-party deployments.

## Highlights

- 🛡️ **Moderation & security** — bans, mutes, warnings, mod logs, AutoMod, AntiRaid, channel locks and audit tools.
- 📊 **XP & community** — levels, leaderboards, profiles, badges, birthdays, autoroles and member management.
- 🎉 **Giveaways & events** — giveaways, polls, events, suggestions, tickets and reaction roles.
- 💰 **Economy & fun** — luazinhas, bank, shop, inventory, coinflip, anime, Pokédex, pets, trivia and waifu/husbando systems.
- 🎵 **Music** — playback, queue, playlists, DJ controls and Lavalink support.
- ⭐ **Community tools** — welcome messages, starboard, keyword triggers, custom commands, fan arts and free-game notifications.
- ❤️ **Support system** — optional LivePix integration for support plans and automatic Discord role delivery after confirmed payments.
- ✨ **Optional smart features** — Discord chat assistant, panel assistant and automated content moderation when the related providers are configured.

## Web dashboard

The dashboard is one of Yue's main parts. After signing in with Discord, administrators can manage their servers through a modern interface instead of configuring everything through slash commands.

It currently includes areas for moderation, AutoMod, AntiRaid, audit logs, members, giveaways, XP, autoroles, tickets, suggestions, reaction roles, starboard, welcome messages, music, custom commands, keyword triggers, support plans and more.

Owner-only tools are also available for global administration and panel configuration.

## Tech stack

| Part | Technology |
| --- | --- |
| Discord bot | Node.js, TypeScript, Discord.js |
| API | Fastify |
| Web panel | React, Vite |
| Database | PostgreSQL, Prisma |
| Cache / queues | Redis |
| Music | Lavalink |
| Package manager | pnpm |
| Deployment | Docker |

## Docker

Yue is published as a multi-architecture image for **linux/amd64** and **linux/arm64**.

Docker Hub:

```bash
docker pull isyuricunha/yue-discord-bot:latest
```

GitHub Container Registry:

```bash
docker pull ghcr.io/isyuricunha/yue-discord-bot:latest
```

The repository includes Compose examples for both internal and external PostgreSQL setups, using either Docker Hub or GHCR images.

A simple starting point is:

```bash
cp .env.docker.example .env
# Fill in the required Discord, database and authentication values.

docker compose -f docker-compose.dockerhub.internal-db.yml up -d
```

Optional integrations such as Lavalink, LivePix, Mistral and OpenAI can be enabled through environment variables when needed.

## Local development

### Requirements

- Node.js 24+
- pnpm 10+
- PostgreSQL
- Redis
- A Discord application

Then:

```bash
git clone https://github.com/isyuricunha/yue-discord-bot.git
cd yue-discord-bot

cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The development command starts the workspace services together. You can also run them separately:

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
├── bot/        Discord bot
├── api/        HTTP API
└── web/        React dashboard

packages/
├── database/   Prisma and database package
├── livepix/    LivePix integration
└── shared/     Shared code and types

prompts/        Runtime prompt files
```

Everything lives in a single pnpm workspace so the bot, API, panel and shared packages can evolve together.

## Useful commands

```bash
pnpm dev          # Run the development workspace
pnpm build        # Build all applications and packages
pnpm lint         # Run lint checks
pnpm type-check   # Run TypeScript checks
pnpm test         # Run tests
pnpm db:generate  # Generate the Prisma client
pnpm db:migrate   # Run database migrations
```

## License

Yue Discord Bot is licensed under the **GNU Affero General Public License v3.0**.

See [LICENSE](LICENSE) for the full license text.
