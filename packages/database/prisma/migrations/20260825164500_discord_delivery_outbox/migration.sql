-- Durable delivery queue for Discord side effects.
CREATE TABLE "discord_deliveries" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "guildId" TEXT,
    "userId" TEXT,
    "channelId" TEXT,
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discord_deliveries_dedupeKey_key" ON "discord_deliveries"("dedupeKey");
CREATE INDEX "discord_deliveries_due_idx" ON "discord_deliveries"("deliveredAt", "failedAt", "availableAt", "claimedAt");
CREATE INDEX "discord_deliveries_guild_idx" ON "discord_deliveries"("guildId", "createdAt");
