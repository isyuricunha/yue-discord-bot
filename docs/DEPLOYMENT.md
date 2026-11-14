# Deploying Yue

How to run the published image, which Compose variant to pick, every environment variable the containers read, and the gotchas that have actually bitten deployments.

## The image

Yue publishes one multi-architecture image (`linux/amd64` and `linux/arm64`) to two registries:

```bash
docker pull isyuricunha/yue-discord-bot:latest      # Docker Hub
docker pull ghcr.io/isyuricunha/yue-discord-bot:latest
```

Tags: `latest` tracks the newest main release; every semantic-release cut also publishes its matching `vX.Y.Z` tag, which is the safest pin for production and the rollback target.

## What runs inside the container

The image is built on `node:24-slim` and runs three processes under supervisord:

| Process | Program | Default port | Notes |
| --- | --- | --- | --- |
| Web panel | `nginx -g "daemon off;"` | 8080 | Serves the built React SPA, proxies `/api` |
| API | `node apps/api/dist/runtime.js` | 3000 (`API_PORT`) | Fastify; the container `HEALTHCHECK` hits `/ready` here |
| Bot | `node apps/bot/dist/runtime.js` | internal 3100 | Skips itself (sleeps) when `ENABLE_BOT=false` |

The `docker-entrypoint.sh` script requires `DATABASE_URL` (hard exit without it), waits for PostgreSQL to accept TCP connections, applies migrations with `prisma migrate deploy` (10 retries), runs `inject-env.sh` to expose `VITE_API_URL` and `VITE_DISCORD_CLIENT_ID` to the SPA through `/env.js`, and then hands over to supervisord. Migrations are replay-safe: CI replays the full set on an empty PostgreSQL database and fails on any schema drift, so a plain `migrate deploy` at container start is the supported update path.

`nginx.conf` (inside the image) serves the SPA on 8080, proxies `/api` to `localhost:3000`, and has a dedicated `^~ /api/partner/vai-brasil/` location proxying to `127.0.0.1:59341`. With a single API process you can only satisfy one of those two ports at a time: leave `API_PORT` at 3000 for the dashboard flow, or set `API_PORT=59341` when you need the partner routes and align your proxying accordingly.

## Compose variants

| File | Image | Database | Intended use |
| --- | --- | --- | --- |
| `docker-compose.dockerhub.internal-db.yml` | Docker Hub | Internal `postgres:16-alpine` + `redis:7-alpine` | Self-contained production start |
| `docker-compose.ghcr.internal-db.yml` | GHCR | Internal `postgres:16-alpine` + `redis:7-alpine` | Same, pulling from GHCR |
| `docker-compose.dockerhub.external-db.yml` | Docker Hub | Bring your own PostgreSQL | You already run PostgreSQL |
| `docker-compose.ghcr.external-db.yml` | GHCR | Bring your own PostgreSQL | Same, pulling from GHCR |
| `docker-compose.example.yml` | `yuebot:local` | Internal | Local development flavor; forwards the whole `.env.docker` via `env_file` |

The internal-db variants create the database and Redis services with healthchecks and volume persistence, and map the panel to the host as `${HOST_WEB_PORT:-80}:8080`. The external-db variants map `${HOST_WEB_PORT:-80}:80`.

### Required variables per variant

- All variants: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `JWT_SECRET`, `INTERNAL_API_SECRET`, `CORS_ORIGINS`, `WEB_URL` are required-if-unset at deploy time.
- External-db variants additionally require `DATABASE_URL` pointing at your PostgreSQL instance. Redis is optional there.
- Internal-db variants additionally require `POSTGRES_PASSWORD` and `REDIS_PASSWORD`.

## Environment reference

Names only below; values belong in your private `.env` and are never versioned.

### Core runtime (bot, `apps/bot/src/config.ts`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` or `DISCORD_BOT_TOKEN` | required | Bot token (either name) |
| `DISCORD_CLIENT_ID` | required | Application ID |
| `DATABASE_URL` | required | PostgreSQL connection string |
| `INTERNAL_API_SECRET` | required (32+ chars) | Shared secret for the API-to-bot internal API |
| `BOT_INTERNAL_PORT` | `3100` | Internal API listen port |
| `BOT_INTERNAL_BIND_HOST` / `BOT_INTERNAL_HOST` | `127.0.0.1` | Internal API bind host (either name) |
| `INTERNAL_API_MAX_BODY_BYTES` | `65536` (max 1 MiB) | Internal API body limit |
| `BOT_READINESS_HOST` | `127.0.0.1` | Readiness server bind |
| `BOT_READINESS_PORT` | internal port + 1 (capped at 65535) | Readiness server port |
| `NODE_ENV` | `development` | Runtime mode |
| `LOG_LEVEL` | `info` | Log level |
| `LOG_FORMAT` | `pretty` (`json` also supported) | Log output format |
| `DISABLE_PRIVILEGED_INTENTS` | `false` | Run without privileged intents where possible |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `WEB_URL` | `http://localhost:5173` | Panel URL used by `/painel` and giveaway flows |

### Dashboard auth and CORS (API, `apps/api/src/config.ts`)

`API_PORT`/`PORT` (`3000`), `API_HOST`, `API_BODY_LIMIT`, `TRUST_PROXY`, `JWT_SECRET` (required, 32+ chars), `JWT_EXPIRES_IN`, `DISCORD_CLIENT_SECRET` (required), `DISCORD_REDIRECT_URI`, `CORS_ORIGINS`, `WEB_URL`/`FRONTEND_URL`, `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_TIME_WINDOW`.

### API-to-bot bridge and caches

`INTERNAL_API_CACHE_TTL_MS`, `INTERNAL_API_CACHE_MAX_ENTRIES`, `API_BOT_STATS_CACHE_TTL_MS`, `API_BOT_STATS_CACHE_MAX_AGE_MS`.

### Redis tuning

`REDIS_PASSWORD` (used when the URL carries no credentials), `REDIS_CONNECT_TIMEOUT_MS` (`3000`), `REDIS_COMMAND_TIMEOUT_MS` (`3000`).

### AI assistants (optional; off without keys)

- Discord assistant: `MISTRAL_API_KEY` (also enables the `/ask` command), `MISTRAL_AGENT_ID`, `MISTRAL_IMAGE_AGENT_ID`, `MISTRAL_MODEL`, `MISTRAL_TEMPERATURE`, `MISTRAL_MAX_TOKENS`, `DISCORD_AI_SYSTEM_PROMPT_PATH` (alias: `MISTRAL_PROMPT_PATH`), `DISCORD_AI_CHAT_TIMEOUT_MS`, `CUSTOM_PROVIDER_BASE_URL` + `CUSTOM_PROVIDER_API_KEY` (OpenAI-compatible provider), `LLM_DEBUG`.
- Panel assistant: `MISTRAL_PANEL_AGENT_ID`, `PANEL_AI_SYSTEM_PROMPT_PATH` (alias: `PANEL_AI_PROMPT_PATH`), `PANEL_AI_CHAT_TIMEOUT_MS`, `CUSTOM_PROVIDER_MODEL_LIST_TIMEOUT_MS`.
- Conversation memory in Redis: `AI_CONTEXT_TTL_SECONDS` (`1800`), `AI_CONTEXT_MAX_MESSAGES` (`12`), `AI_CONTEXT_MAX_MESSAGE_CHARS` (`700`), `AI_CONTEXT_CONTINUATION_SECONDS` (`120`), `AI_CONTEXT_ACTIVITY_CACHE_MAX_KEYS` (`5000`), `AI_CONTEXT_REDIS_PREFIX` (`yue:ai:context`).

### AI moderation (optional)

`OPENAI_API_KEY`, `OPENAI_MODERATION_IMAGE_MAX_BYTES` (default 20 MiB, clamp 64 KiB to 50 MiB), `OPENAI_MODERATION_IMAGE_PAYLOAD_MAX_BYTES` (default 45 MiB, clamp 1 to 50 MiB).

### Music

`LAVALINK_NODES` (JSON array of node definitions), `LAVALINK_DISABLED_NODES`.

### LivePix payments (optional)

`LIVEPIX_ENABLED` (`false`), `LIVEPIX_CLIENT_ID`, `LIVEPIX_CLIENT_SECRET`, `LIVEPIX_OAUTH_REDIRECT_URI`, `LIVEPIX_WEBHOOK_URL`, `LIVEPIX_TOKEN_ENCRYPTION_KEY` (must decode to 32 bytes), `LIVEPIX_OWNER_GUILD_IDS`, `LIVEPIX_PAYMENT_RETURN_URL` or `LIVEPIX_RETURN_URL`.

### Shared Nobre bridge (optional)

`VB_SHARED_NOBRE_ENABLED`, `VB_SHARED_NOBRE_GUILD_ID`, `VB_SHARED_NOBRE_ROLE_ID`, `VB_SHARED_NOBRE_TOKEN` (40+ chars, shared with the portal), `VB_SHARED_NOBRE_ORIGIN` (HTTPS), `VB_SHARED_NOBRE_EXTERNAL_WORKER` (`1` routes reconciliation to the legacy sidecar units instead of the in-bot scheduler), `VB_SHARED_NOBRE_WORKER_ENABLED`, `VB_SHARED_NOBRE_LISTENER_ENABLED` (sidecars only), `VB_NOBRE_LIFETIME_ROLE_ID`, `VB_SITE_CHECKOUT_ENABLED`. The website side adds `VB_DISCORD_LINK_ENABLED`, `VB_DISCORD_CLIENT_ID`, `VB_DISCORD_CLIENT_SECRET`. Details in [SHARED-NOBRE-VAI-BRASIL.md](SHARED-NOBRE-VAI-BRASIL.md).

### Owner and reviewer lists (CSV of Discord user IDs)

`OWNER_USER_IDS`, `GLOBAL_XP_RESET_USER_IDS`, `BADGE_ADMIN_USER_IDS`, `FAN_ART_REVIEWER_USER_IDS`. Owner status is re-derived from `OWNER_USER_IDS` on every authenticated request, so removing an ID revokes access on the next request.

### Web panel

Build-time: `VITE_API_URL`, `VITE_DISCORD_CLIENT_ID` (overridden at runtime through `/env.js`), `VITE_DEV_API_PROXY` (development proxy only).

### Feature caches

`KEYWORD_TRIGGER_CACHE_TTL_MS` (`10000`), `CUSTOM_COMMAND_CACHE_TTL_MS` (`10000`), `SUGGESTION_CONFIG_CACHE_TTL_MS` (`10000`), `GAMERPOWER_CACHE_TTL_MS`, `BOT_STATS_CACHE_TTL_MS`, `BOT_STATS_CACHE_MAX_AGE_MS`.

### Test-only

`RUN_DATABASE_INTEGRATION` gates database integration tests; never set it in production.

## Updating

```bash
docker compose -f <variant>.yml pull
docker compose -f <variant>.yml up -d
```

The entrypoint applies pending migrations before the processes start. Rollback: point the variant at the previous `vX.Y.Z` tag and recreate; migrations are forward-only, so roll back only to a tag whose migrations your database already satisfies.

## Known gotchas

- **External-db variants ship a broken web port mapping.** They map the host port to container port 80, but nginx listens on 8080, so the panel is unreachable as shipped. Fix the mapping to target container port 8080 (the internal-db variants already do `${HOST_WEB_PORT:-80}:8080`).
- **`DATABASE_URL` and `POSTGRES_PASSWORD` are coupled in the internal-db variants.** The Compose default `DATABASE_URL` only matches the built-in default password. The moment you set `POSTGRES_PASSWORD`, update `DATABASE_URL` to the same password, or the API and bot fail to authenticate to the database.
- **The four published variants do not forward the LivePix variables.** `LIVEPIX_*` settings exist in `.env.docker.example`, but only `docker-compose.example.yml` (which forwards the whole file via `env_file`) passes them through. To use support payments on a published variant, add the `LIVEPIX_*` entries to its `environment` block or switch to an `env_file`.
- **The API port is published on the loopback interface** (`127.0.0.1:${HOST_API_PORT:-3000}:3000`) on purpose: the API is meant to be reached through the panel's nginx same-origin proxy, not directly from the network.
