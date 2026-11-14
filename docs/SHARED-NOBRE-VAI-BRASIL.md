# Vai Brasil! and Yue | Shared Nobre

## Purpose and boundaries

A member may contribute exclusively through the **website**, exclusively through **Discord**, or through both. **Linking accounts is optional**. Without a link, the two systems remain independent and their payments are never associated by name, e-mail, avatar or similarity. With the link confirmed through Discord OAuth2, a verified credit from either platform starts sharing a single Nobre expiry.

This integration is deliberately **additive**: it never deletes or rewrites Yue's original payments and benefits. Other servers served by the bot do not participate, even if they use the same LivePix account. Synchronization only operates on the explicitly configured server and role.

## Secure linking

In the `/conta?section=security` area, the user finds **Discord connected**. The interface queries `GET /api/v1/discord/status`. When OAuth is enabled, `GET /api/v1/discord/start` requires a session and a verified e-mail and starts the Discord `identify` authorization. The server creates a random 256-bit state token, stores only its SHA-256 hash for at most ten minutes, and protects it with an HTTP-only, Secure, SameSite Lax cookie. The callback exchanges the code for a token through the official API, queries `GET /users/@me`, consumes the state exactly once, and stores the immutable Discord identifier in `ExternalIdentity`, with unique indexes to prevent duplicated identities.

`POST /api/v1/discord/unlink` requires a verified session and the correct Origin header. Unlinking does not delete payment history nor credits already merged into the website expiry. The bot stops using the website-provided expiry at the next reconciliation, but keeps any Discord-native benefit still active. The user may pay on each platform separately without ever connecting accounts.

Linking carries no message, e-mail or automatic server-entry scopes. The bot only grants the role to members already present in the chosen server.

## Authoritative credit and entitlement

Vai Brasil! keeps the shared expiry for linked accounts, while Yue preserves the financial record and the Discord-native benefit. **These are not two financial authorizations**: each purchase is confirmed at its own origin provider. Yue only emits events for payments it has itself marked as `FULFILLED`. The website API receives those events from an authenticated service, never from users or public webhooks.

On the first link, Yue captures the **time still remaining** of the native benefit and sends the `legacy` marker exactly once. The website adds that balance to the current expiry, in a transaction. Afterwards, every Discord payment is sent with the `guildId`, the immutable payment ID, the `discordId`, the purchased days and the completion instant. The website stores one `SharedNobreCredit` per origin/payment ID pair. Replays are idempotent, and old payments already merged into the initial marker are never summed again.

External credit transactions lock the user row, just like the website's own checkout confirmation. Two distinct payments add days in order, without overwriting each other's validity. Pre-existing periods on both platforms are preserved by summing the **time still remaining**, not by naively summing historical totals since account creation.

The query endpoint `GET /api/v1/nobre-bridge/links` returns only linked Discord pairs and the shared expiry date. `POST /api/v1/nobre-bridge/credit` only accepts the shared credential, an authorized server, a typed payload, a valid ID and a unique credit key. Never trust browser-provided parameters to grant days. The channel uses HTTPS, protected access and no caching.

## Synchronization modes

The same `syncSharedNobre` logic is bundled into several entry points; the environment selects who runs it.

**Native mode (default, and what production runs).** The bot's `SupportScheduler` calls `syncSharedNobre` every five minutes whenever `VB_SHARED_NOBRE_EXTERNAL_WORKER` is not `1`, alongside the entitlement expiration and reminder batches. Native expirations are processed in the same cycle through the transactional outbox. No second Discord gateway, no host dependencies, no extra processes: everything ships inside the standard image.

**Legacy sidecar mode.** Setting `VB_SHARED_NOBRE_EXTERNAL_WORKER=1` disables the in-bot sync and delegates it to the versioned units in `deploy/systemd/`:

- `vb-nobre-rest-worker.service` + `.timer`: a one-shot REST reconciliation every five minutes, entered by `apps/bot/src/nobreWorker.ts` (uses only `Client.rest.setToken`, never `Client.login`), gated by `VB_SHARED_NOBRE_WORKER_ENABLED=1`.
- `vb-nobre-native-expiry.service`: processes native entitlement expirations through the outbox, gated by the same worker flag.
- `vb-nobre-live-listener.service`: a persistent daemon (`apps/bot/src/nobreNotifyListener.ts`) that LISTENs on the `vb_nobre_site_changed` and `vb_nobre_yue_changed` PostgreSQL channels and starts the worker within seconds of a committed change, gated by `VB_SHARED_NOBRE_LISTENER_ENABLED=1`. It also schedules an expiry trigger at the earliest future expiration across both systems.

In sidecar mode the units source the bot's private environment file and must be kept in pairs; never start two gateway connections of the same bot. The five-minute timer remains the recovery path: the listener only reduces latency, and a listener outage degrades updates to the five-minute cadence.

Mode selection is reversible at any time by flipping the flag and stopping or re-creating the corresponding units.

## The Nobre role in Yue

The reconciliation queries the links and applies the role to the existing member of the configured server: add when the link is active and unexpired, remove when the shared expiry has passed, constrained by role provenance. The implementation keeps `SharedNobreMirror` in its own database table, without rewriting the bot's native payment history.

Role removal respects provenance, not just expiry: migration `20261018165000_shared_nobre_role_provenance` added the `roleManagedByBridge` column (default false). Only roles granted by the bridge, or assumed by it when deferring a native removal, may be removed when the shared benefit ends. An administrative or manually assigned role with no managed history stays untouched.

If the website is temporarily unavailable, Yue does not turn the communication failure into a mass removal: it keeps the previous mirror and retries. The website likewise keeps downloads working regardless of bot availability.

## Configuration

**Nothing is activated by deploying alone.** The security switches stay off by default.

On the website, in the private environment:

- `VB_DISCORD_LINK_ENABLED=0` initially;
- `VB_DISCORD_CLIENT_ID` and `VB_DISCORD_CLIENT_SECRET`: credentials of the Discord application whose redirect URI is authorized;
- `VB_SHARED_NOBRE_ENABLED=0` initially;
- `VB_SHARED_NOBRE_TOKEN`: a random secret of at least 40 characters, identical in the bot;
- `VB_SHARED_NOBRE_GUILD_ID`: the benefiting Discord server.

On the bot, in the private environment:

- `VB_SHARED_NOBRE_ENABLED=1` to let the scheduler perform the sync (leave `VB_SHARED_NOBRE_EXTERNAL_WORKER` unset or `0` for native mode);
- `VB_SHARED_NOBRE_ORIGIN=https://traducao.yuricunha.com`;
- `VB_SHARED_NOBRE_TOKEN`: the same secret;
- `VB_SHARED_NOBRE_GUILD_ID`: the same server;
- `VB_SHARED_NOBRE_ROLE_ID`: the ID of the manageable supporter role in that server.

Activation steps, in order:

1. Confirm which Yue server integrates with Vai Brasil!, and which Nobre role is associated with that server's plans.
2. Authorize the exact URI **`https://traducao.yuricunha.com/api/v1/discord/callback`** in the Discord application.
3. Validate, with a test account, OAuth, rejection of already-linked Discord accounts, session sign-out and unlinking; enable linking afterwards.
4. Prepare a **read-only** initial reconciliation of the selected server. Review pre-existing expiries and payment states without accidentally bulk-importing.
5. Configure server/role and the shared private credential; enable the website service first, then the bot, with health checks on each service.
6. Test with a linked test user, two simulated purchases, an event replay, expiry and recovery after a communication loss. Observe the result on the website and on the Yue role without charging real money.
7. Only after all of these conditions are verified, enable member synchronization. Never enable it automatically by push or build.

### Migrations

Website: `20261018143000_shared_nobre_oauth_credits`, the `DISCORD_LINK` enum and the `SharedNobreCredit` table. Bot: `20261018145000_shared_nobre_mirror`, the mirror table; `20261018165000_shared_nobre_role_provenance`, role provenance. None of them remove existing data or modify the financial tables.

### Database migration parity in CI

The `shared_nobre_mirrors.updatedAt` PostgreSQL column has a database-level `CURRENT_TIMESTAMP` default in the immutable migration `20261018145000_shared_nobre_mirror`. The Prisma model must describe the same default with `@default(now())`, in addition to `@updatedAt` (which continues to update the field on Prisma Client writes).

Never rewrite an already-applied migration to fix drift. CI replays all migrations in an isolated PostgreSQL 16 database, then runs `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. An exit status of 2 signals a genuine schema difference and should be fixed in the schema or a new forward migration, not hidden by disabling the check.

## The partner API (website to Yue)

The Yue panel is the authoritative source for plans and amounts. The partner endpoint exposes only enabled, non-archived, ordered plans; it does not expose the role, private panel data, credentials or other users' payments. The website uses the linked Discord OAuth identity and a private service credential, and never accepts a Discord ID from the browser or a client-provided price. The endpoint requires Bearer authentication verified in constant time and a scope restricted to the selected server.

Checkout through the website writes a single `SupportPayment` into Yue's financial database, with immutable plan and cost snapshots, an active OWNER LivePix connection and a role validated by the existing bot. It reuses known pending checkouts; uncertain transactions stay in `CREATING` with a unique `pendingKey`, blocked for manual review, without automatic resubmission to the provider. For a `PENDING` contribution, the encrypted checkout link is recoverable after 24 hours only when the URL is HTTPS and belongs exactly to `checkout.livepix.gg`; this reuse does not create a new payment and preserves the `pendingKey` uniqueness. Never arbitrarily delete pending payments to create new checkouts.

The private integration is served by an independent API process with no Discord gateway client, sharing only existing infrastructure and the financial model. Checkout control requires `VB_SITE_CHECKOUT_ENABLED=1` on both services; start with the value off, verify authentication, the plan catalog, identity handling, log hygiene, history and simulated payment tests, and enable it only after every check passes. A Yue outage blocks new payments on the website; there is no fallback that creates a charge on the portal's database.

The manual lifetime check (`POST /api/partner/vai-brasil/lifetime`) verifies membership and compares the role set with `VB_NOBRE_LIFETIME_ROLE_ID` through the official Discord API. A missing member responds `lifetime=false`; network errors and malformed responses return 503. It never changes roles or LivePix payments; the portal stores the validated projection with a five-minute TTL.

## Controls

Any service authentication failure blocks the shared API. No web client can call the bridge with an administrator credential. There is no access to the Yue panel or to other communities' financial data. Synchronization logs never store tokens or checkout payloads. Secrets are never versioned.

No server or roleId may be guessed, copied from similarly named entries or chosen automatically when multiple communities exist. Link changes never transfer the original payment right to another identity without human review.

## Official references

- [Discord OAuth2, authorization code and state protection](https://discord.com/developers/docs/topics/oauth2)
- [Discord /users/@me with the identify scope](https://discord.com/developers/docs/resources/user)
- [Discord: adding/removing a role of an existing member](https://discord.com/developers/docs/resources/guild)
- [Prisma: transactions and serializable isolation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [LivePix API](https://docs.livepix.gg/api)
