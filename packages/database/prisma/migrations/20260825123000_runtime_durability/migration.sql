-- Remove a legacy session table that is no longer referenced by the runtime.
DROP TABLE IF EXISTS "sessions";

-- Remove legacy PascalCase cooldown tables left by the historical migration chain.
DROP TABLE IF EXISTS "GuildCommandCooldown";
DROP TABLE IF EXISTS "UserCommandCooldown";

-- Keep only the newest cooldown state for each user/guild/command before
-- enforcing the one-row state-machine invariant.
DELETE FROM "user_command_cooldowns" AS older
USING "user_command_cooldowns" AS newer
WHERE older."guildId" = newer."guildId"
  AND older."userId" = newer."userId"
  AND older."commandName" = newer."commandName"
  AND (
    older."usedAt" < newer."usedAt"
    OR (older."usedAt" = newer."usedAt" AND older."id" < newer."id")
  );

DROP INDEX IF EXISTS "user_command_cooldowns_guildId_userId_commandName_idx";
DROP INDEX IF EXISTS "user_command_cooldowns_usedAt_idx";
CREATE UNIQUE INDEX "user_command_cooldowns_guildId_userId_commandName_key"
  ON "user_command_cooldowns"("guildId", "userId", "commandName");

CREATE TABLE "voice_xp_sessions" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "lastAwardedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_xp_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_xp_sessions_guildId_userId_key"
  ON "voice_xp_sessions"("guildId", "userId");
CREATE INDEX "voice_xp_sessions_lastAwardedAt_idx"
  ON "voice_xp_sessions"("lastAwardedAt");
