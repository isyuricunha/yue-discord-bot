-- CreateEnum
CREATE TYPE "AniListMediaType" AS ENUM ('anime', 'manga');

-- CreateTable
CREATE TABLE "anilist_watchlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" "AniListMediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "siteUrl" TEXT,
    "imageUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextAiringAt" INTEGER,
    "nextAiringEpisode" INTEGER,
    "lastNotifiedAiringAt" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anilist_notification_settings" (
    "userId" TEXT NOT NULL,
    "dmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_notification_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "anilist_notification_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anilist_watchlist_items_mediaType_enabled_nextCheckAt_idx" ON "anilist_watchlist_items"("mediaType", "enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "anilist_watchlist_items_userId_mediaType_createdAt_idx" ON "anilist_watchlist_items"("userId", "mediaType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "anilist_watchlist_items_userId_mediaType_mediaId_key" ON "anilist_watchlist_items"("userId", "mediaType", "mediaId");

-- CreateIndex
CREATE INDEX "anilist_notification_channels_guildId_idx" ON "anilist_notification_channels"("guildId");

-- CreateIndex
CREATE INDEX "anilist_notification_channels_userId_idx" ON "anilist_notification_channels"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "anilist_notification_channels_userId_guildId_key" ON "anilist_notification_channels"("userId", "guildId");

-- AddForeignKey
ALTER TABLE "anilist_watchlist_items" ADD CONSTRAINT "anilist_watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anilist_notification_settings" ADD CONSTRAINT "anilist_notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anilist_notification_channels" ADD CONSTRAINT "anilist_notification_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anilist_notification_channels" ADD CONSTRAINT "anilist_notification_channels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
