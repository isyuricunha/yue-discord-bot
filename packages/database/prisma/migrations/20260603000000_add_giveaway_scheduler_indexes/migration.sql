CREATE INDEX IF NOT EXISTS "giveaways_ended_cancelled_suspended_endsAt_idx"
ON "giveaways"("ended", "cancelled", "suspended", "endsAt");

CREATE INDEX IF NOT EXISTS "giveaways_ended_cancelled_suspended_messageId_startsAt_createdAt_idx"
ON "giveaways"("ended", "cancelled", "suspended", "messageId", "startsAt", "createdAt");
