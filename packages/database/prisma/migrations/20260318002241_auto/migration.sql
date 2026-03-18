-- AlterTable
ALTER TABLE "user_birthdays" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "lastInterestAt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "GuildCommandCooldown";

-- DropTable
DROP TABLE "UserCommandCooldown";

-- CreateTable
CREATE TABLE "guild_command_cooldowns" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_command_cooldowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_command_cooldowns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_command_cooldowns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_command_cooldowns_guildId_idx" ON "guild_command_cooldowns"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_command_cooldowns_guildId_commandName_key" ON "guild_command_cooldowns"("guildId", "commandName");

-- CreateIndex
CREATE INDEX "user_command_cooldowns_guildId_userId_commandName_idx" ON "user_command_cooldowns"("guildId", "userId", "commandName");

-- CreateIndex
CREATE INDEX "user_command_cooldowns_usedAt_idx" ON "user_command_cooldowns"("usedAt");

-- AddForeignKey
ALTER TABLE "guild_command_cooldowns" ADD CONSTRAINT "guild_command_cooldowns_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
