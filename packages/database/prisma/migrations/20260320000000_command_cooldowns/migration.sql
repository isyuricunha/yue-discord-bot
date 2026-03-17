-- Create GuildCommandCooldown table
CREATE TABLE "GuildCommandCooldown" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildCommandCooldown_guildId_commandName_key" UNIQUE ("guildId", "commandName")
);

-- Create UserCommandCooldown table
CREATE TABLE "UserCommandCooldown" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCommandCooldown_guildId_userId_commandName_key" UNIQUE ("guildId", "userId", "commandName")
);

-- Create indexes for performance
CREATE INDEX "GuildCommandCooldown_guildId_idx" ON "GuildCommandCooldown"("guildId");
CREATE INDEX "UserCommandCooldown_guildId_userId_idx" ON "UserCommandCooldown"("guildId", "userId");

-- Add foreign key relation to Guild (if Guild table exists)
-- ALTER TABLE "GuildCommandCooldown" ADD CONSTRAINT "GuildCommandCooldown_guildId_fkey" 
--   FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
