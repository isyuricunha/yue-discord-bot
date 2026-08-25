# Performance Audit

This file tracks the repository-wide performance audit and its implementation milestones.

## Baseline

- Repository scope: bot, API, web dashboard, shared packages, database schema, migrations, and seeds.
- Web production bundle before route splitting: 1,854,949 bytes of initial JavaScript.
- Web production bundle after route splitting: 620,271 bytes of initial JavaScript.
- Initial JavaScript reduction: 1,234,678 bytes (66.6%).

## Completed

- [x] Map the main runtime flows across the bot, API, web dashboard, and database.
- [x] Identify high-frequency database access in message and interaction handlers.
- [x] Identify sequential startup and API queries that can be parallelized safely.
- [x] Split web pages into route-level chunks without changing routes or features.
- [x] Keep the application and public shells visible while route chunks load.
- [x] Validate the web milestone with lint, type-check, tests, build, and browser rendering.
- [x] Cache keyword trigger reads per guild with concurrent-load deduplication and explicit invalidation.
- [x] Cache suggestion configuration reads with bounded staleness and a per-guild invalidation hook.
- [x] Batch AFK mention lookups into one query while preserving mention order.
- [x] Index first-message autorole pendings in memory with startup hydration and database fallback.
- [x] Reuse XP configuration and updated member state during level-up processing, removing up to three redundant queries.
- [x] Serialize XP message, voice, transfer, and prestige writes with bounded conflict retries.
- [x] Synchronize startup guild records with bounded concurrency and completion telemetry.
- [x] Parallelize guild overview and coinflip statistics queries while reusing loaded activity data.
- [x] Move API credential validation to runtime startup so isolated tests remain CI-safe.
- [x] Add the AutoMod link-safety configuration contract, domain normalization, and additive migration.
- [x] Enforce link policies before other message handlers with local fallback, configurable punishments, and notices.
- [x] Add responsive dashboard controls for link policies, trusted domains, notices, and timeout validation.
- [x] Preserve exact hostname boundaries when mirroring link rules to Discord AutoMod.
- [x] Remove the unused network-based URL expander and redundant AFK export.

## Runtime Durability Milestone — August 25, 2026

### Economy and cooldown correctness

- [x] Make daily reward claims atomic with Serializable transactions and bounded conflict retries.
- [x] Guarantee one daily credit/transaction under concurrent claims.
- [x] Replace command cooldown read-then-write behavior with one atomic reservation state transition.
- [x] Enforce one cooldown row per `guildId + userId + commandName` at the database level.
- [x] Deduplicate legacy cooldown rows before creating the unique invariant.
- [x] Add PostgreSQL integration tests that fire 12 concurrent daily claims and 12 concurrent cooldown reservations.

### Message hot path

- [x] Add bounded positive and negative AFK caching so repeated non-AFK messages do not repeat the same database miss.
- [x] Keep AFK cache growth capped instead of introducing an unbounded process cache.
- [x] Gate conversation handling before queue work for messages that cannot trigger it.
- [x] Reuse the existing XP configuration cache in message handling instead of adding another read path.

### Voice XP durability

- [x] Persist active Voice XP sessions in PostgreSQL instead of relying only on process memory.
- [x] Flush full-minute Voice XP checkpoints every 60 seconds and during shutdown/leave transitions.
- [x] Update XP and session checkpoints together inside Serializable transactions.
- [x] Reconcile persisted sessions against Discord voice state on startup.
- [x] Remove stale sessions and avoid awarding bot downtime after a restart.
- [x] Keep one persisted Voice XP session per guild/user and index checkpoint maintenance.

### Internal Bot ↔ API protocol

- [x] Share request schemas/types for sensitive internal moderation, profile, panel and music operations.
- [x] Bound internal request bodies to 64 KiB by default, with a configurable hard ceiling of 1 MiB.
- [x] Return `413` for oversized internal bodies and `400` for malformed JSON.
- [x] Authenticate internal requests before consuming their bodies.
- [x] Centralize strict server-only environment parsing in `@yuebot/shared/env`.
- [x] Reject partial numeric values such as `123abc` instead of silently accepting them as valid ports/limits.
- [x] Keep the server-only env entry point separated from the browser-facing shared bundle.

### Database cleanup, replay, and invariants

- [x] Remove the unused legacy `sessions` table.
- [x] Add only evidence-backed runtime indexes/invariants instead of speculative indexing.
- [x] Add persistent `voice_xp_sessions` storage and the cooldown uniqueness invariant.
- [x] Restore full `prisma migrate deploy` replay on a brand-new PostgreSQL database without changing checksums of historical migrations.
- [x] Add conditional compatibility migrations for historical out-of-order objects and clean their transient replay state before the canonical migrations run.
- [x] Remove legacy PascalCase cooldown tables after the historical chain has completed.

### CI guardrails

- [x] Start PostgreSQL 16 in the permanent `checks` job without a committed test password.
- [x] Replay the complete Prisma migration history into the disposable integration database.
- [x] Fail CI if the replayed database drifts from `schema.prisma`.
- [x] Run database concurrency integration tests on pull requests with `RUN_DATABASE_INTEGRATION=1`.
- [x] Run Knip as a permanent CI dead-code check alongside lint, type-check, tests and build.

Fresh installations and CI now use the same migration path as deployment: `prisma migrate deploy`. Compatibility migrations are conditional no-ops on databases where the affected historical migrations are already recorded as applied, so existing production migration checksums remain untouched.

## Next Milestones

The next performance pass should be measurement-driven rather than another broad cleanup sweep.

- [ ] Add slow Prisma query logging with route/service context.
- [ ] Track p95/p99 API latency by route.
- [ ] Track bot message-event duration and conversation queue depth.
- [ ] Track Voice XP flush duration and active-session count.
- [ ] Measure cache hit/miss rates for high-frequency guild configuration caches.
- [ ] Profile payload sizes and query time on large-guild endpoints.
- [ ] Continue page-by-page web query and render profiling after the route-splitting baseline.

## Validation Policy

Each milestone must preserve existing behavior and pass the relevant lint, type-check, test, build, runtime, database integration, migration replay, drift, and dead-code checks before the next milestone starts.
