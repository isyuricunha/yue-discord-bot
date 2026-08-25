-- Reconcile schema elements that existed in the runtime schema but were never
-- represented by the historical migration chain. The guards make this safe on
-- existing databases where these objects may already exist.

-- AlterTable
ALTER TABLE "guild_configs"
  ADD COLUMN IF NOT EXISTS "aiModerationAction" TEXT NOT NULL DEFAULT 'delete',
  ADD COLUMN IF NOT EXISTS "aiModerationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "guild_xp_configs"
  ADD COLUMN IF NOT EXISTS "voiceXpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "voiceXpRate" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "guild_xp_members"
  ADD COLUMN IF NOT EXISTS "lastVoiceXpAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prestige" INTEGER NOT NULL DEFAULT 0;

-- These defaults/types are part of the current Prisma schema and are safe to
-- normalize even when the production database already matches them.
ALTER TABLE "user_birthdays"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "wallets"
  ALTER COLUMN "lastInterestAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "custom_commands" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "custom_commands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "hunger" INTEGER NOT NULL DEFAULT 100,
    "energy" INTEGER NOT NULL DEFAULT 100,
    "happiness" INTEGER NOT NULL DEFAULT 100,
    "hygiene" INTEGER NOT NULL DEFAULT 100,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trivia_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trivia_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "custom_commands_guildId_idx"
  ON "custom_commands"("guildId");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_commands_guildId_name_key"
  ON "custom_commands"("guildId", "name");
CREATE INDEX IF NOT EXISTS "pets_userId_idx"
  ON "pets"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "trivia_stats_userId_key"
  ON "trivia_stats"("userId");
CREATE INDEX IF NOT EXISTS "trivia_stats_userId_score_idx"
  ON "trivia_stats"("userId", "score");

-- AddForeignKey. PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS, so guard each
-- relation through pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_commands_guildId_fkey'
      AND conrelid = '"custom_commands"'::regclass
  ) THEN
    ALTER TABLE "custom_commands"
      ADD CONSTRAINT "custom_commands_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "guilds"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pets_userId_fkey'
      AND conrelid = '"pets"'::regclass
  ) THEN
    ALTER TABLE "pets"
      ADD CONSTRAINT "pets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trivia_stats_userId_fkey'
      AND conrelid = '"trivia_stats"'::regclass
  ) THEN
    ALTER TABLE "trivia_stats"
      ADD CONSTRAINT "trivia_stats_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
