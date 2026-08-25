-- Compatibility objects required only while replaying the historical chain.
-- Production databases already applied the following migration, so they skip this.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260318002241_auto'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    CREATE TABLE IF NOT EXISTS "user_birthdays" (
      "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "GuildCommandCooldown" ("id" TEXT);
    CREATE TABLE IF NOT EXISTS "UserCommandCooldown" ("id" TEXT);
    ALTER TABLE "wallets"
      ADD COLUMN IF NOT EXISTS "lastInterestAt" TIMESTAMP;
  END IF;
END
$$;
