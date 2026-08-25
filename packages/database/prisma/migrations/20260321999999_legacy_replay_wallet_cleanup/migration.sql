-- Drop the replay-only interest column before the real economy migration adds it.
-- Existing databases already applied the real migration and therefore no-op here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260322000000_economy_bank_system'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    ALTER TABLE "wallets" DROP COLUMN IF EXISTS "lastInterestAt";
  END IF;
END
$$;
