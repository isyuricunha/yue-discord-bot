# Yue Discord Bot (YueBot)

YueBot is a feature-rich Discord bot with a modern web admin panel. It includes moderation tools, XP/levels, giveaways, economy, music, AI-powered features, and more.

> **This bot is production-ready.** However, I do not provide support for custom deployments or other instances.

## Commands

YueBot offers a wide variety of commands organized by category:

### Moderation

- **Ban**: Ban members from your server
- **Kick**: Remove members from your server
- **Mute**: Temporarily mute members
- **Unmute**: Unmute muted members
- **Warn**: Warn members for violations
- **Unwarn**: Remove warnings from members
- **Baninfo**: Check ban information
- **Modlog**: View moderation logs
- **Antiraid**: Configure anti-raid protection
- **Lock/Unlock**: Lock and unlock channels
- **Clear**: Bulk delete messages

### XP & Levels

- **Rank**: Check your level and XP
- **Leaderboard**: View top members by XP
- **Levelup**: Configure level up messages
- **Prestige**: Reset your level for rewards
- **Transfer**: Transfer XP to another member

### Giveaways

- **Sorteio**: Create giveaways with custom titles, descriptions, and winner counts
- **Sorteio-lista**: Create giveaways with a predefined list of items
- **Sorteio-wizard**: Interactive giveaway creation with step-by-step guide

### Economy & Games

- **Coinflip**: Flip coins for luazinhas (in-game currency)
- **Bank**: Check your bank balance
- **Shop**: Browse and purchase items
- **Inventory**: View your collected items
- **Daily**: Claim daily rewards
- **Loja**: Create and manage shop items

### Music

- **Play**: Play music from YouTube, Spotify, and other sources
- **Skip**: Skip the current track
- **Stop**: Stop playback and clear queue
- **Volume**: Adjust playback volume
- **Queue**: View the current music queue
- **Nowplaying**: See what's currently playing
- **Playlist**: Manage playlists
- **DJ**: Configure music settings

### AI Features

- **Ask**: Chat with AI models (Mistral, Groq)
- **Auto-moderation**: AI-powered content moderation (requires OpenAI API key)

### Waifu Collection

- **Waifu**: View waifu information
- **Husbando**: View husbando information
- **Marry**: Marry your favorite character
- **Divorce**: Divorce your current waifu/husbando
- **Casar**: Alternative marry command
- **Divorciar**: Alternative divorce command
- **Ranking**: View waifu collection rankings
- **Wishlist**: Manage your wishlist
- **Meuharem**: View your harem
- **Infocasamento**: View marriage information
- **Waifupontos**: Manage waifu points

### Profile & Social

- **Profile**: View your profile with XP, badges, and statistics
- **Badges**: Manage and view badges
- **Aniversario**: Set your birthday

### Fan Art

- **Fanart**: Submit and view fan art submissions
- **Verify Message**: Verify messages for fan art submissions

### Utility

- **Ping**: Check bot latency
- **Poll**: Create polls
- **Evento**: Create event announcements
- **Pet**: Interact with virtual pets
- **Trivia**: Play anime trivia games
- **Gatilho**: Configure trigger words
- **Config**: Configure server settings
- **Ticket**: Create support tickets
- **Reaction Roles**: Set up reaction roles
- **Report**: Report issues
- **Say**: Make the bot say something
- **Afk**: Set AFK status
- **Voltei**: Remove AFK status
- **Limpar**: Clean messages
- **Painel**: Create custom panels

## Tech Stack

- **Backend**: Node.js 24+, TypeScript, Fastify API
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + Vite
- **Discord**: Discord.js v14
- **Package Manager**: pnpm
- **Infrastructure**: Redis (for queues), Docker support
- **AI Services**: Mistral AI, Groq, OpenAI (optional)

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL 15+
- Redis 6+ (for job queues)
- Discord Application (bot token + OAuth)
- Lavalink server (for music features, optional)

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

# Run database migrations
pnpm db:migrate

# Run database seed (optional)
pnpm db:seed

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

### Environment Variables

YueBot uses multiple environment files for different purposes:

- **`.env`**: Main configuration file (copy from `.env.example`)
- **`.env.local`**: Local overrides (copy from `.env.local.example`)

#### Required Variables

- `DATABASE_URL` - PostgreSQL connection string
- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_CLIENT_SECRET` - Your Discord application client secret
- `JWT_SECRET` - Session secret (32+ characters minimum)
- `INTERNAL_API_SECRET` - Secret for API <-> Bot communication
- `DISCORD_REDIRECT_URI` - OAuth callback URL (e.g., `http://localhost:3000/api/auth/callback`)

#### Database & Caching

- `REDIS_URL` - Redis connection string (e.g., `redis://localhost:6379`)
- `REDIS_PASSWORD` - Redis password if required

#### AI Services (Optional)

Enable AI features by providing API keys:

**Mistral AI** (primary):

- `MISTRAL_API_KEY` - Your Mistral API key
- `MISTRAL_MODEL` - Model to use (default: `mistral-small-latest`)
- `MISTRAL_TEMPERATURE` - Temperature for responses (default: `0.2`)
- `MISTRAL_MAX_TOKENS` - Max tokens per response (default: `512`)

**Groq** (fallback):

- `GROQ_API_KEY` - Your Groq API key
- `GROQ_MODEL` - Model to use (default: `llama3-8b-8192`)
- `GROQ_TEMPERATURE` - Temperature for responses (default: `0.2`)
- `GROQ_MAX_TOKENS` - Max tokens per response (default: `512`)

**OpenAI** (auto-moderation):

- `OPENAI_API_KEY` - Your OpenAI API key for AI-powered moderation

#### Music Features (Optional)

For music functionality, configure Lavalink:

```json
LAVALINK_NODES='[{"name": "Node 1", "url": "localhost:2333", "auth": "youshallnotpass", "secure": false}]'
```

#### Admin Configuration

- `BADGE_ADMIN_USER_IDS` - Comma-separated list of user IDs who can manage badges
- `FAN_ART_REVIEWER_USER_IDS` - Comma-separated list of user IDs who can review fan art

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Run all services (bot + API + web) |
| `pnpm dev:bot` | Run only the Discord bot |
| `pnpm dev:api` | Run only the API server |
| `pnpm dev:web` | Run only the web panel |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push database schema changes |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm deploy-commands` | Deploy Discord slash commands |
| `pnpm build` | Build all applications |
| `pnpm lint` | Run linter checks |

## License

AGPL-3.0 - See [LICENSE](LICENSE) file.
