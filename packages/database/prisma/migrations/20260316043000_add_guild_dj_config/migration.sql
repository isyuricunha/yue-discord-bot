-- CreateTable
CREATE TABLE "guild_dj_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceChannelId" TEXT,
    "textChannelId" TEXT,
    "playlistUrl" TEXT,
    "defaultPlaylistUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_dj_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_dj_configs_guildId_key" ON "guild_dj_configs"("guildId");

-- AddForeignKey
ALTER TABLE "guild_dj_configs" ADD CONSTRAINT "guild_dj_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
