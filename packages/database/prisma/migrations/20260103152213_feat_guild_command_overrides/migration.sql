-- CreateEnum
CREATE TYPE "GuildCommandType" AS ENUM ('slash', 'context');

-- CreateTable
CREATE TABLE "guild_command_overrides" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandType" "GuildCommandType" NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_command_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_command_overrides_guildId_idx" ON "guild_command_overrides"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_command_overrides_guildId_commandType_commandName_key" ON "guild_command_overrides"("guildId", "commandType", "commandName");

-- AddForeignKey
ALTER TABLE "guild_command_overrides" ADD CONSTRAINT "guild_command_overrides_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
