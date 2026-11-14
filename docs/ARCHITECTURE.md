# Architecture

How Yue is put together: the runtimes, the bridges between them, and the patterns that keep Discord interactions reliable.

## The big picture

```text
                    ┌────────────────────────────────────────────┐
                    │              one container                 │
                    │                                            │
 Discord gateway ───┤  bot runtime (discord.js)                  │
 Discord REST   ───┤    ├─ commands / events / handlers          │
                    │    ├─ lifecycle services and schedulers    │
                    │    └─ internal HTTP API  ▲                 │
                    │                          │ bearer secret   │
 Browser ──────────┤  nginx :8080 → React SPA   │                │
                    │       └─ /api ──────→ Fastify API :3000 ───┘
                    │                            │      │
                    └────────────────────────────┼──────┼─────┘
                                                 │      │
                                     PostgreSQL (Prisma) │
                                            Redis ◄──────┘
                                        (BullMQ, caches, AI memory)
```

Every Discord action requested from the panel flows Web → API → bot internal API. The panel never talks to Discord directly.

## Runtimes

- **Bot (`apps/bot`)** — discord.js client with slash and context-menu commands, event handlers, and the lifecycle services listed below. Owns every Discord gateway interaction.
- **API (`apps/api`)** — Fastify control plane: Discord OAuth sign-in for the dashboard, guild configuration, moderation, giveaways, XP, economy, support, plus the Vai Brasil partner routes and the Panel AI assistant. Delegates all Discord-side effects to the bot.
- **Web (`apps/web`)** — React 19 + Vite SPA served by nginx; locale files live here (the bot itself has no i18n).

In production all three run in one container under supervisord (see [DEPLOYMENT.md](DEPLOYMENT.md)); in development they run as three processes (`pnpm dev`).

## Internal API (API → bot)

The bot exposes an HTTP API bound to `127.0.0.1` (default port `3100`), authenticated by the shared `INTERNAL_API_SECRET` (32+ characters). Request and response shapes are defined once as zod schemas in `packages/shared/src/internal-api_contract.ts` and reused by both sides. The surface covers health and stats, the command catalog, presence, app description, guild and channel inspection, permission checks, moderation actions, ticket panels, reaction-role publishing, AutoMod rule sync, music control, and support role validation/verification/entitlement operations. The API caches a few hot endpoints (`INTERNAL_API_CACHE_*`).

Authorization is re-checked live: the API re-validates guild access against the bot on each request and re-derives owner status from `OWNER_USER_IDS` on every authenticated call, so removed owners lose access immediately.

## The Discord delivery outbox

Anything the bot must send to Discord as a side effect (giveaway results, free-game announcements, AniList episode notices, support DMs, role removals) is written as a `DiscordDelivery` row inside the same database transaction as the state change that caused it. The `DiscordDeliveryScheduler` drains the queue:

- poll every 5 seconds, claim leases prevent double processing;
- dedupe keys make retries idempotent;
- exponential backoff from 5 seconds to a 5-minute cap, up to 12 attempts;
- known permanent Discord error codes (deleted channel/message/role, missing access) end the attempt chain instead of retrying.

This is why a restart never drops a pending announcement and never sends it twice.

## Lifecycle services and schedulers

All registered in `apps/bot/src/runtime/create_bot_runtime.ts`:

| Service | Purpose | Cadence |
| --- | --- | --- |
| `DiscordDeliveryScheduler` | Drains the transactional outbox | 5 s |
| `VoiceXpService` | XP for active voice participants; persisted checkpoints | 60 s flush + events |
| `GiveawayScheduler` | Publishes giveaways, finalizes them on BullMQ, picks winners | 15 s + delayed jobs |
| `AniListWatchlistScheduler` | Tracks next airing episodes, queues notifications | 60 s repeatable job |
| `WarnExpirationService` | Expires warnings past the per-guild window | hourly |
| `AutoroleScheduler` | Grants due (delayed) autoroles | 30 s |
| `ScheduledEventScheduler` | Event reminders (24 h / 1 h / 10 min) and auto-end | 30 s |
| `InventoryExpirationScheduler` | Expires timed inventory items and temporary roles | 60 s |
| `PollExpirationScheduler` | Ends polls, notifies, edits the embed | 60 s |
| `FreeGameScheduler` | Fetches the GamerPower catalog, filters per guild, enqueues announcements | 15 min |
| `SupportScheduler` | Shared Nobre sync (when not delegated), entitlement expiration batch, reminder batch | 5 min |
| `RuntimeHeartbeatService` | Readiness snapshot in logs | 5 min |

## Support payments and the shared Nobre bridge

Support plans (LivePix OAuth payments) create `SupportPayment`/`SupportEntitlement` records; role delivery runs through the outbox, and the scheduler processes expirations and reminders.

When the optional Vai Brasil! integration is configured, the same scheduler also runs `syncSharedNobre`: it pulls the linked-account list from the portal's authenticated bridge (`/api/v1/nobre-bridge/*`), maintains the `SharedNobreMirror` projection, and adds or removes the configured Nobre role without ever touching roles it did not grant. Legacy sidecar entry points (`nobreWorker`, `nobreExpirationWorker`, `nobreNotifyListener`) and the units in `deploy/systemd/` exist for deployments that prefer synchronization outside the bot process; `VB_SHARED_NOBRE_EXTERNAL_WORKER=1` selects that mode. Full details in [SHARED-NOBRE-VAI-BRASIL.md](SHARED-NOBRE-VAI-BRASIL.md).

## Data layer

`packages/database` owns the Prisma schema (PostgreSQL driver adapter, shared pool singleton) and the migrations. Models span moderation and guild configuration, giveaways, XP, economy, entertainment, users and profiles, LivePix payments, and reliability tables (`DiscordDelivery`, `PanelAiFeedback`, `SharedNobreMirror`). CI replays every migration on an empty PostgreSQL database and fails on schema drift, which is what makes the container's `migrate deploy` at startup safe.

## AI features

The Discord assistant and the panel assistant are optional and provider-agnostic: a Mistral agent or any OpenAI-compatible endpoint (`CUSTOM_PROVIDER_BASE_URL`). Discord conversations keep history in Redis with TTL and message caps; panel AI history is in memory on the API. The panel assistant can propose configuration changes and apply them through explicit confirm endpoints. AI moderation (OpenAI) covers text and images with per-guild thresholds and safe fallbacks.

## Music

Playback is Lavalink-backed through Kazagumo; nodes are configured via `LAVALINK_NODES`. The 24-hour DJ mode keeps a default playlist looping and restores it across restarts.
