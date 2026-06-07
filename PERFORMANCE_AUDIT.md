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

## Next Milestones

- [ ] Review command cooldown cleanup so it does not issue unnecessary deletes per invocation.
- [ ] Match high-frequency queries to database indexes and add migrations only where evidence supports them.
- [ ] Continue page-by-page web query and render profiling after the route-splitting baseline.
- [ ] Complete AutoMod enforcement and dashboard controls for link safety policies.

## Validation Policy

Each milestone must preserve existing behavior and pass the relevant lint, type-check, test, build, and runtime checks before the next milestone starts.
