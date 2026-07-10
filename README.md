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

- **Ask**: Chat with the configured Mistral runtime
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
- **AI Services**: Mistral AI, OpenAI (optional), and an optional OpenAI-compatible panel provider

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
- `KEYWORD_TRIGGER_CACHE_TTL_MS` - Bot keyword trigger cache lifetime in milliseconds (default: `10000`; set to `0` to disable stored entries)
- `SUGGESTION_CONFIG_CACHE_TTL_MS` - Bot suggestion config cache lifetime in milliseconds (default: `10000`; set to `0` to disable stored entries)

#### AI Services (Optional)

Enable AI features by providing API keys:

**Mistral AI** (primary):

- `MISTRAL_API_KEY` - Your Mistral API key
- `MISTRAL_AGENT_ID` - Optional Mistral agent ID for tool-enabled conversations
- `MISTRAL_IMAGE_AGENT_ID` - Optional Mistral agent ID configured with the `image_generation` connector for chat image generation
- `MISTRAL_MODEL` - Model to use (default: `mistral-small-latest`)
- `MISTRAL_TEMPERATURE` - Temperature for responses (default: `0.2`)
- `MISTRAL_MAX_TOKENS` - Max tokens per response (default: `512`)

**Panel assistant (optional):**

- `MISTRAL_PANEL_AGENT_ID` - Dedicated Mistral Agent for panel chat; configure it without connectors or tools
- `CUSTOM_PROVIDER_BASE_URL` - Base URL of a generic OpenAI-compatible provider
- `CUSTOM_PROVIDER_API_KEY` - Optional bearer key for that provider; it is never stored in the database
- `PANEL_AI_CHAT_TIMEOUT_MS` - Panel chat timeout (default: `90000`, maximum: `180000`)
- `CUSTOM_PROVIDER_MODEL_LIST_TIMEOUT_MS` - Manual model-list refresh timeout (fixed at five minutes)

The Owner chooses the global panel runtime in **Admin → Ella no Painel**. The custom catalog is fetched only when requested, cached in the database, and keeps the previous catalog if a refresh fails. Guild Admins/Owners can use the panel chat, but cannot change its provider or model. The panel chat has no web, image, attachment, or tool access.

### v3 breaking changes

- Groq and all multi-key/round-robin Mistral fallback variables were removed.
- Use one `MISTRAL_API_KEY` for Discord AI and rename any prompt mount to `prompts/system_prompt.txt`.
- Conversation cache variables are now `AI_CONTEXT_*`; remove any `GROQ_CONTEXT_*` settings.

**OpenAI** (auto-moderation):

- `OPENAI_API_KEY` - Your OpenAI API key for AI-powered moderation
- `OPENAI_MODERATION_IMAGE_MAX_BYTES` - Max size downloaded per image before moderation (default: `20971520`)
- `OPENAI_MODERATION_IMAGE_PAYLOAD_MAX_BYTES` - Max image payload sent to moderation per request (default: `47185920`)

#### LivePix Support Payments (Optional)

LivePix support payments are configured per guild from the web panel under **Suporte > Apoios**. Members use `/apoiar` in Discord, choose one of the guild-defined plans, and receive the configured role only after Yue verifies the LivePix payment with the connected LivePix account.

Required when `LIVEPIX_ENABLED=true`:

- `LIVEPIX_CLIENT_ID` - LivePix OAuth application client ID
- `LIVEPIX_CLIENT_SECRET` - LivePix OAuth application client secret
- `LIVEPIX_OAUTH_REDIRECT_URI` - Public API callback URL, for example `https://api.example.com/api/livepix/oauth/callback`
- `LIVEPIX_WEBHOOK_URL` - Public API webhook URL used for deployment validation and operator display, for example `https://yuebot.yuricunha.com/api/livepix/webhook`
- `LIVEPIX_PAYMENT_RETURN_URL` - Public return URL passed to LivePix payment creation, for example `https://api.example.com/api/livepix/return`
- `LIVEPIX_TOKEN_ENCRYPTION_KEY` - 32-byte secret used to encrypt LivePix access tokens and checkout URLs at rest. It can be a 64-character hex string, base64 that decodes to 32 bytes, or a raw 32-byte string.

Optional:

- `LIVEPIX_OWNER_GUILD_IDS` - Comma-separated guild IDs allowed to use the bot owner's LivePix credentials instead of guild OAuth.

Operational notes:

- Configure the application-level notification URL manually in the LivePix application dashboard before accepting payments. For Yue production, set it to `https://yuebot.yuricunha.com/api/livepix/webhook`.
- Yue relies on the LivePix application dashboard notification URL to receive webhook events from connected users. It does not call the per-user `GET /v2/webhooks` or `POST /v2/webhooks` APIs during account connection, dashboard loading, checkout creation, or normal startup.
- The bot needs Discord `Manage Roles`, and the supporter role must be below the bot's highest role.
- Plans are one-time payments in BRL cents with a fixed duration in days. Recurring subscriptions are not implemented.
- Users do not link Discord accounts to LivePix. Yue correlates checkout rows by provider payment reference, then fetches the payment from the connected account before granting roles.
- Webhooks are deduplicated and sanitized before persistence. Raw webhook bodies, access tokens, and checkout URLs are not exposed in API responses.
- OAuth access tokens are encrypted at rest. If an OAuth token expires, reconnect the LivePix account from the dashboard.
- If role synchronization fails because of permissions or hierarchy, fix the Discord role setup and use the dashboard retry action.

#### Music Features (Optional)

For music functionality, configure Lavalink:

```env
LAVALINK_NODES='[{"name": "Node 1", "url": "localhost:2333", "auth": "youshallnotpass", "secure": false}]'
LAVALINK_DISABLED_NODES="Node 1,Old Public Node"
```

Set `enabled: false` on a node entry, or list node names in `LAVALINK_DISABLED_NODES`, to keep unstable external Lavalink nodes out of the runtime connection pool.

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
