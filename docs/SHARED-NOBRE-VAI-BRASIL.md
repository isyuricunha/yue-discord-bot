# Vai Brasil! and Yue | Shared Nobre

## Purpose and boundaries

A member may contribute exclusively through the **website**, exclusively through **Discord**, or through both. **Linking accounts is optional**. Without a link, the two systems remain independent and their payments are never associated by name, e-mail, avatar or similarity. With the link confirmed through Discord OAuth2, a verified credit from either platform starts sharing a single Nobre expiry.

This deployment is deliberately **additive**: it never deletes or rewrites Yue's original payments and benefits. Other servers served by the bot do not participate, even if they use the same LivePix account. Synchronization only operates on the explicitly configured server and role.

## Secure linking

In the `/conta?section=security` area, the user finds **Discord connected**. The interface queries `GET /api/v1/discord/status`. When OAuth is enabled, `GET /api/v1/discord/start` requires a session and a verified e-mail and starts the Discord `identify` authorization. The server creates a random 256-bit state token, stores only its SHA-256 hash for at most ten minutes, and protects it with an HTTP-only, Secure, SameSite Lax cookie. The callback exchanges the code for a token through the official API, queries `GET /users/@me`, consumes the state exactly once, and stores the immutable Discord identifier in `ExternalIdentity`, with unique indexes to prevent duplicated identities.

`POST /api/v1/discord/unlink` requires a verified session and the correct Origin header. Unlinking does not delete payment history nor credits already merged into the website expiry. The bot stops using the website-provided expiry at the next reconciliation, but keeps any Discord-native benefit still active. The user may pay on each platform separately without ever connecting accounts.

Linking carries no message, e-mail or automatic server-entry scopes. The bot only grants the role to members already present in the chosen server.

## Authoritative credit and entitlement

Vai Brasil! keeps the shared expiry for linked accounts, while Yue preserves the financial record and the Discord-native benefit. **These are not two financial authorizations**: each purchase is confirmed at its own origin provider. Yue only emits events for payments it has itself marked as `FULFILLED`. The website API receives those events from an authenticated service, never from users or public webhooks.

On the first link, Yue captures the **time still remaining** of the native benefit and sends the `legacy` marker exactly once. The website adds that balance to the current expiry, in a transaction. Afterwards, every Discord payment is sent with the `guildId`, the immutable payment ID, the `discordId`, the purchased days and the completion instant. The website stores one `SharedNobreCredit` per origin/payment ID pair. Replays are idempotent, and old payments already merged into the initial marker are never summed again.

External credit transactions lock the user row, just like the website's own checkout confirmation. Two distinct payments add days in order, without overwriting each other's validity. Pre-existing periods on both platforms are preserved by summing the **time still remaining**, not by naively summing historical totals since account creation.

The query endpoint `GET /api/v1/nobre-bridge/links` returns only linked Discord pairs and the shared expiry date. `POST /api/v1/nobre-bridge/credit` only accepts the shared credential, an authorized server, a typed payload, a valid ID and a unique credit key. Never trust browser-provided parameters to grant days. The channel uses HTTPS, protected access and no caching.

## The Nobre role in Yue

The bot queries the links every five minutes and before the native expiry process. With an active link and an unexpired shared expiry, it adds the role to the existing member of the configured server. The implementation keeps `SharedNobreMirror` in its own database table, without rewriting the bot's native payment history. The native removal respects the shared expiry, to avoid stripping the role when the member renewed through the website. When both expiries pass, the role may be removed; when the link is removed, only Discord-origin benefits remain in the bot.

If the website is temporarily unavailable, Yue does not turn the communication failure into a mass removal: it keeps the previous mirror and retries. The website likewise keeps downloads working regardless of bot availability.

## Configuration and activation

**Nothing is activated by deploying alone.** The security switches stay off by default:

On the website, in the private environment:
- `VB_DISCORD_LINK_ENABLED=0` initially;
- `VB_DISCORD_CLIENT_ID` and `VB_DISCORD_CLIENT_SECRET`: credentials of the Discord application whose redirect URI is authorized;
- `VB_SHARED_NOBRE_ENABLED=0` initially;
- `VB_SHARED_NOBRE_TOKEN`: a random secret of at least 40 characters, identical in the bot;
- `VB_SHARED_NOBRE_GUILD_ID`: the benefiting Discord server.

On the bot, in the private environment:
- `VB_SHARED_NOBRE_ENABLED=0` initially;
- `VB_SHARED_NOBRE_ORIGIN=https://traducao.yuricunha.com`;
- `VB_SHARED_NOBRE_TOKEN`: the same secret;
- `VB_SHARED_NOBRE_GUILD_ID`: the same server;
- `VB_SHARED_NOBRE_ROLE_ID`: the ID of the manageable supporter role in that server.

Mandatory activation steps:
1. Confirm which Yue server integrates with Vai Brasil!, and which Nobre role is associated with that server's plans.
2. Authorize the exact URI **`https://traducao.yuricunha.com/api/v1/discord/callback`** in the Discord application.
3. Validate, with a test account, OAuth, rejection of already-linked Discord accounts, session sign-out and unlinking; enable linking afterwards.
4. Prepare a **read-only** initial reconciliation of the selected server. Review pre-existing expiries and payment states without accidentally bulk-importing.
5. Configure server/role and the shared private credential; enable the website service first, then the bot, with health checks on each service.
6. Test with a linked test user, two simulated purchases, an event replay, expiry and recovery after a communication loss. Observe the result on the website and on the Yue role without charging real money.
7. Only after all of these conditions are verified, enable member synchronization. Never enable it automatically by push or build.

### Migrations

Website: `20261018143000_shared_nobre_oauth_credits`, the `DISCORD_LINK` enum and the `SharedNobreCredit` table, with no removal of existing data. Bot: `20261018145000_shared_nobre_mirror`, a role mirror table, with no modification of existing financial tables.

### Controls

Any service authentication failure blocks the shared API. No web client can call the bridge with an administrator credential. There is no access to the Yue panel or to other communities' financial data. Synchronization logs never store tokens or checkout payloads. Secrets are never versioned.

No server or roleId may be guessed, copied from similarly named entries or chosen automatically when multiple communities exist. Link changes never transfer the original payment right to another identity without human review.

## Official references

- [Discord OAuth2, authorization code and state protection](https://discord.com/developers/docs/topics/oauth2)
- [Discord /users/@me with the identify scope](https://discord.com/developers/docs/resources/user)
- [Discord: adding/removing a role of an existing member](https://discord.com/developers/docs/resources/guild)
- [Prisma: transactions and serializable isolation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)

## Real link verification and role safety

- A real OAuth link was confirmed in production. The private bridge returned a single link with mandatory authentication; on inspection, the portal held no imported credits nor active Nobre benefits. This is expected for an administrative account with no recorded contribution: administrative access does not equal a Nobre payment.
- Discord confirmed the role is manageable and sits below the bot's role. No member or role was changed during that test.
- Inspecting the expiry routine identified a risk of removing manually assigned roles. Migration **`20261018165000_shared_nobre_role_provenance`** added the `roleManagedByBridge` column (default false) to the Yue database. Only roles granted by the bridge, or assumed by it when deferring a native removal, may be removed when the shared benefit ends. An administrative/manual role with no managed history stays untouched.
- The provenance-specific tests, the Yue suite, TypeScript, lint and build all passed. An isolated pre-activation image was built successfully while the current bot stayed healthy. No restart was performed and no second Discord client was started.
- Website linking and the private bridge are active. Yue automatic synchronization remains off in the running container. Enabling it requires a controlled image promotion and validation with real linked benefits, with no risk of duplicate gateway processing.

## Delivery status

OAuth linking and the credit bridge are active. The initial import was applied and a short-running REST reconciler is operational and scheduled every five minutes, without creating a second gateway and without restarting the main bot. The main runtime activation key stays off; the independent unit is the sole component performing synchronization until a controlled runtime promotion.

## Pre-activation implementation evidence

- The additive migration `20261018143000_shared_nobre_oauth_credits` was applied to the portal database; migration `20261018145000_shared_nobre_mirror` was applied to the Yue database. Both ended in a consistent state, with no data removal.
- The only Yue community with support configured and a connected provider is Vai Brasil!, and its plans use a single role. The target was identified through an authenticated query for private configuration only; its IDs are neither exposed nor versioned.
- The four Discord plans were normalized to 30 days/R$ 35, 60 days/R$ 70, 90 days/R$ 90 and 180 days/R$ 180. The previous 365-day plan was archived for new contributions only. Snapshots of amounts and durations of old payments were not changed, and the change preserved the financial audit trail.
- The existing Discord application credentials and a shared random token are prepared in private configuration (never exposed in repositories). The `VB_DISCORD_LINK_ENABLED` and `VB_SHARED_NOBRE_ENABLED` switches stay off so synchronization cannot start before callback authorization and the safe bot version swap.
- The website's automated tests cover verified session and e-mail, single-use OAuth2, state and cookie, an unlink attempt from another origin, disabled credentials, external credit ingestion, replay of the same payment, rejection of unlinked credits and preservation of recorded balances. Yue also has tests covering role preservation with a linked expiry and unchanged behavior when the bridge is disabled.
- TypeScript, the portal suite, lint, tests and Yue type checks all passed. The website Chromium test at 1440, 768, 390 and 320 px confirmed the disabled link form, the optional-linking notice, a simulated unlink, and no horizontal overflow or exceptions.
- The website was promoted with a blue/green deploy and health checks with no downtime, with only two previous releases. The current Yue process remains available with its existing native benefits. The new bot integration is ready for release as an isolated step, without overlapping the active Discord session before activation.
- No messages were sent to Discord, no real role was assigned, and no test purchase or financial event was created. Live synchronization depends on the callback registered in the Discord application and on an end-to-end validation with a test account.

## Independent REST execution (2026-10-18)

Synchronization was enabled without restarting Yue's main session. The entry point `apps/bot/src/nobreWorker.ts` uses exclusively `Client.rest.setToken`, never `Client.login`, to run `syncSharedNobre`. An isolated unit schedules a short run every five minutes. The process requires `VB_SHARED_NOBRE_WORKER_ENABLED=1` in the private environment and reuses the configured credentials; the main instance keeps `VB_SHARED_NOBRE_ENABLED=0`.

At activation time: 2 linked accounts, 2 initial import markers, 1 link with a valid Nobre entitlement, 2 mirrors and the role present for the active beneficiary. The 39 records of confirmed Discord payments and the eight active native benefits remain preserved. The integration run passed with the main session healthy and no additional Gateway login.

Reconciler operations are idempotent. Per-user failures do not interrupt the others, but mark the run as partially unsuccessful for operational records. The embedded bot application contains logic to protect the role on native expiry; while it is not yet promoted to the Gateway client in use, there is a possibility of a brief temporary role loss when a Discord support payment expires, until the next REST cycle. **The deployed units are also versioned in `deploy/systemd/` and must be kept in pairs. Before promoting the main runtime with synchronization enabled, disable the REST timer.** Never start two Gateway connections of the same bot. The worker neither replaces nor modifies Yue's payments, subscriptions or moderation.

## Event-driven Nobre synchronization

The additive October 2026 migrations on both databases emit `LISTEN/NOTIFY` notices only after commit. Yue's persistent service receives signals from both databases and invokes the REST reconciliation without opening an extra Gateway. Payments, revocations and links are processed within seconds under normal conditions. The five-minute timer remains as recovery, and the administrative projection is updated when Yue confirms a change. Units are versioned in `deploy/systemd/vb-nobre-live-listener.service` and full documentation lives in the portal project at `docs/NOBRE-LIVE-EVENTS.md`.

### Post-activation validations

Notifications from both databases were confirmed after commit, no notification after rollback, automatic role update through REST, administrative snapshot update after an event (14 seconds in testing), and credit integrity on the website. Subscription/network failures are handled with reconnection, startup with a fresh reconciliation and the five-minute timer. The implementation keeps a second check after native changes to avoid racing the previous runtime's role removal. The single main Discord client stayed healthy, without restart.

## Operational status after the Yue promotion (2026-10-18)

Yue's main version was promoted with a versioned local image, after build, tests and UI/API verification of a candidate instance without a Gateway. Swapping the main instance caused only one controlled Discord client reconnection, with no double session; final health checks stayed healthy. The native expiry guard uses the shared mirror and remains active in the main application, while the independent REST work continues to be responsible for events, avoiding duplicated reconciliation.

For the main application: `VB_SHARED_NOBRE_ENABLED=1` and `VB_SHARED_NOBRE_EXTERNAL_WORKER=1` in the private environment. The `vb-nobre-live-listener.service` unit receives committed signals from both databases, and `vb-nobre-rest-worker.timer` remains as the five-minute safety net.

### Expiry scheduling

The event listener computes the earliest future expiry across the linked portal benefits and the authorized Yue community and schedules the trigger for that instant (with a small slack). When the date arrives, the REST reconciler updates the mirror/role and the `vb-nobre-native-expiry.service` routine processes native expiries through the existing transactional outbox. An expiry change reschedules the next trigger. Schedules are rebuilt on restart/reconnect; no in-memory timer is the sole recovery guarantee. The five-minute routine remains as contingency.

Precise expiry here means automatic scheduling on the date, subject to database latency, the outbox queue, Discord API rate limits and network availability. It is not a guarantee of removal within the same millisecond.

### Evidence and the financial verification limit

In production, 39 historical Yue payments remain in the `FULFILLED` state; 8 native Nobre members remain active, 2 `BOT_LEGACY` markers were imported and the replay created no new credits. The Discord bot and its roles passed the smoke test. The portal API still has no purchases of its own. The automated test with simulated confirmation covered correct pricing, proof of receipt, rejection on mismatch, accumulation and idempotency. An independent historical payment query to the provider returned HTTP 400; therefore **do not declare** a new real end-to-end purchase through the portal complete without an authorized financial operation and a positive provider response.

The previous image and private cutover configurations are preserved for rollback. Never include that data or credentials in repositories. The native expiry unit was versioned as `deploy/systemd/vb-nobre-native-expiry.service`.

## Shared catalog and checkout (2026-10-19)

The Yue panel is the authoritative source for plans and amounts. The partner endpoint exposes only enabled, non-archived, ordered plans. It does not expose the role, private panel data, credentials or other users' payments. The website uses the linked Discord OAuth identity and a private service credential, and never accepts a Discord ID from the browser or a client-provided price. The endpoint requires Bearer authentication verified in constant time and a scope restricted to the selected server.

Checkout through the website writes a single SupportPayment into Yue's financial database, with immutable plan and cost snapshots, an active OWNER LivePix connection and a role validated by the existing bot. It reuses known pending checkouts; uncertain transactions stay in CREATING with a unique pendingKey, blocked for manual review, without automatic resubmission to the provider. LivePix receives an informational-only return for the portal's Nobre area. Confirmation happens through the official API verification and the webhook Yue already operates; benefit synchronization with the website continues through the idempotent bridge, with no second webhook and no second financial ledger.

The private integration is served by an independent API process, with no Discord gateway client, sharing only existing infrastructure and the financial model. The process listens only inside the bot's network namespace, on a fixed high port, exposed externally only through the protected path on Yue's proxy. Do not start a second gateway or restart the main container to activate the integration. The partner API deploy is reversible by disabling its route while keeping the original Yue intact.

Checkout control requires VB_SITE_CHECKOUT_ENABLED=1 on both services. Start with the value off, verify 401 authentication, the plan catalog, user identity, logs without secrets, history and simulated payment tests; enable it only after every check passes. A Yue outage blocks new payments on the website. There is no fallback that creates a charge on the portal's database.

References: https://docs.livepix.gg/api and https://discord.com/developers/docs/topics/oauth2.

## PENDING checkout reuse and portal resumption (2026-10-19)

For a PENDING contribution, the encrypted checkout link is recoverable even after 24 hours, provided the URL is HTTPS and belongs exactly to checkout.livepix.gg. This reuse does not create a new payment and preserves the pendingKey uniqueness key. Old links were verified with GET against LivePix without performing any transaction. The partner history endpoint returns the checkout only to the Discord ID queried through the portal's authenticated API, never for completed/CREATING payments or different destinations. All existing identity and status guards remain mandatory. Never arbitrarily delete pending payments to create new checkouts.

## Manual Lifetime Nobre role

The private partner API exposes POST /api/partner/vai-brasil/lifetime, protected by the same Bearer credential and guild scope. It queries the user's membership directly through the official Discord API using the existing bot and compares the role set with VB_NOBRE_LIFETIME_ROLE_ID. The identifier was confirmed by exact name in the guild, not taken from the browser. A missing member responds lifetime=false; network errors and malformed responses return 503. It never changes roles or LivePix payments. The portal stores the validated projection with a five-minute TTL.

## Database migration parity in CI (2026-10-22)

The shared_nobre_mirrors.updatedAt PostgreSQL column has a database-level
CURRENT_TIMESTAMP default in the immutable migration
20261018145000_shared_nobre_mirror. The Prisma model must describe the same
database default with @default(now()), in addition to @updatedAt (which
continues to update the field in Prisma Client writes).

Never rewrite an already-applied migration to fix drift. The CI replays all
migrations in an isolated PostgreSQL 16 database, then runs
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code.
An exit status of 2 signals a genuine schema difference and should be fixed
in the schema or a new forward migration, not hidden by disabling the check.
This alignment does not require a production database migration or Yue bot restart.
