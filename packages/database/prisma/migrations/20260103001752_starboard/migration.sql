-- CreateTable
CREATE TABLE "starboard_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "starboard_posts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "starboardChannelId" TEXT NOT NULL,
    "starboardMessageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starboard_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "starboard_configs_guildId_key" ON "starboard_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "starboard_posts_starboardMessageId_key" ON "starboard_posts"("starboardMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "starboard_posts_guildId_sourceMessageId_key" ON "starboard_posts"("guildId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "starboard_posts_guildId_createdAt_idx" ON "starboard_posts"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "starboard_posts_guildId_starCount_idx" ON "starboard_posts"("guildId", "starCount");

-- AddForeignKey
ALTER TABLE "starboard_configs" ADD CONSTRAINT "starboard_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "starboard_posts" ADD CONSTRAINT "starboard_posts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
