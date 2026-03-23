-- CreateTable
CREATE TABLE "free_game_notifications" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "roleIds" JSONB NOT NULL DEFAULT '[]',
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "giveawayTypes" JSONB NOT NULL DEFAULT '[]',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_game_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_game_giveaways" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" TEXT NOT NULL,

    CONSTRAINT "free_game_giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "free_game_notifications_guildId_idx" ON "free_game_notifications"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "free_game_notifications_guildId_key" ON "free_game_notifications"("guildId");

-- CreateIndex
CREATE INDEX "free_game_giveaways_giveawayId_idx" ON "free_game_giveaways"("giveawayId");

-- CreateIndex
CREATE INDEX "free_game_giveaways_guildId_idx" ON "free_game_giveaways"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "free_game_giveaways_giveawayId_guildId_key" ON "free_game_giveaways"("giveawayId", "guildId");

-- AddForeignKey
ALTER TABLE "free_game_notifications" ADD CONSTRAINT "free_game_notifications_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_game_giveaways" ADD CONSTRAINT "free_game_giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
