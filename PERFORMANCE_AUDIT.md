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

## Next Milestones

- [ ] Batch AFK mention lookups instead of querying mentioned users sequentially.
- [ ] Reduce per-message autorole pending-work database reads.
- [ ] Review XP message processing queries and transaction boundaries.
- [ ] Parallelize independent bot startup guild synchronization operations with bounded concurrency.
- [ ] Parallelize independent API statistics and dashboard queries.
- [ ] Review command cooldown cleanup so it does not issue unnecessary deletes per invocation.
- [ ] Match high-frequency queries to database indexes and add migrations only where evidence supports them.
- [ ] Continue page-by-page web query and render profiling after the route-splitting baseline.

## Validation Policy

Each milestone must preserve existing behavior and pass the relevant lint, type-check, test, build, and runtime checks before the next milestone starts.
