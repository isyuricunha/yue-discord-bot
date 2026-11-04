-- HoneyPot trap channel configuration, one row per guild.
-- CreateTable
CREATE TABLE "guild_honey_pot_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_honey_pot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_honey_pot_configs_guildId_key" ON "guild_honey_pot_configs"("guildId");

-- AddForeignKey
ALTER TABLE "guild_honey_pot_configs" ADD CONSTRAINT "guild_honey_pot_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
