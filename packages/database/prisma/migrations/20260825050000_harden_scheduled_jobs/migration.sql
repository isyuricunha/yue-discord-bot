-- Make scheduled/background work retryable and index its real access paths.

ALTER TABLE "mod_logs" ADD COLUMN "warnExpiredAt" TIMESTAMP(3);
UPDATE "mod_logs"
SET "warnExpiredAt" = CURRENT_TIMESTAMP
WHERE "action" = 'warn' AND "metadata"->>'warnExpired' = 'true';
CREATE INDEX "mod_logs_warn_expiration_idx" ON "mod_logs"("guildId", "action", "warnExpiredAt", "createdAt");

ALTER TABLE "scheduled_events"
  ADD COLUMN "reminder24hClaimedAt" TIMESTAMP(3),
  ADD COLUMN "reminder1hClaimedAt" TIMESTAMP(3),
  ADD COLUMN "reminder10mClaimedAt" TIMESTAMP(3);
CREATE INDEX "scheduled_events_due_end_idx" ON "scheduled_events"("ended", "cancelled", "startsAt");
CREATE INDEX "scheduled_events_24h_due_idx" ON "scheduled_events"("ended", "cancelled", "reminder24hSent", "reminder24hAt");
CREATE INDEX "scheduled_events_1h_due_idx" ON "scheduled_events"("ended", "cancelled", "reminder1hSent", "reminder1hAt");
CREATE INDEX "scheduled_events_10m_due_idx" ON "scheduled_events"("ended", "cancelled", "reminder10mSent", "reminder10mAt");

ALTER TABLE "polls"
  ADD COLUMN "expirationClaimedAt" TIMESTAMP(3),
  ADD COLUMN "expirationNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "expirationMessageUpdatedAt" TIMESTAMP(3);
UPDATE "polls"
SET "expirationNotifiedAt" = "updatedAt",
    "expirationMessageUpdatedAt" = "updatedAt"
WHERE "ended" = true;
DROP INDEX IF EXISTS "polls_endsAt_idx";
CREATE INDEX "polls_due_expiration_idx" ON "polls"("ended", "endsAt");

ALTER TABLE "inventory_items" ADD COLUMN "expirationClaimedAt" TIMESTAMP(3);
CREATE INDEX "inventory_items_due_expiration_idx" ON "inventory_items"("expiredHandledAt", "expiresAt");

CREATE INDEX "autorole_pending_due_idx" ON "guild_autorole_pendings"("waitForFirstMessage", "executeAt", "updatedAt");

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "giveawayId", "userId"
    ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "giveaway_winners"
)
DELETE FROM "giveaway_winners"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "giveaway_winners_giveaway_user_key" ON "giveaway_winners"("giveawayId", "userId");
