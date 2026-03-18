# Yue Discord Bot (YueBot)

YueBot is a Discord bot with a web admin panel. It includes moderation tools, XP/levels, giveaways, economy, and more.

> **This bot is production-ready.** However, I do not provide support for custom deployments or other instances.

## Features

- Moderation (ban, kick, mute, warn, etc.)
- XP and leveling system
- Giveaways with prizes
- Economy and coinflip games
- Waifu/husbando collection system
- Anime search (AniList)
- Web admin panel
- And more...

## Tech Stack

- Node.js 24+
- pnpm
- TypeScript
- PostgreSQL + Prisma
- Fastify API
- Discord.js
- React + Vite

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL
- Discord Application (bot token + OAuth)

### Local Development

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push

# Run all services (bot, API, web)
pnpm dev
```

Or run individually:

```bash
pnpm dev:bot    # Discord bot
pnpm dev:api    # API server
pnpm dev:web    # Web panel
```

Default URLs:

- Web UI: <http://localhost:5173>
- API: <http://localhost:3000>

### Deploy Slash Commands

```bash
pnpm --filter @yuebot/bot deploy-commands
```

## Docker

### Using Docker Compose

```bash
# With internal PostgreSQL
docker compose -f docker-compose.dockerhub.internal-db.yml up -d --build
```

Ports:

- Web: <http://localhost:80>
- API: <http://localhost:3000>

### Using Pre-built Image

```bash
docker pull isyuricunha/yue-discord-bot
```

## Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `DISCORD_CLIENT_ID` - Discord app client ID
- `DISCORD_CLIENT_SECRET` - Discord app client secret
- `DISCORD_TOKEN` - Discord bot token
- `JWT_SECRET` - Session secret (32+ characters)
- `INTERNAL_API_SECRET` - Internal API secret
- `DISCORD_REDIRECT_URI` - OAuth callback URL

## License

AGPL-3.0 - See LICENSE file.
