-- Compatibility shim for fresh migration replays.
-- Existing databases already applied the historical DROP, so this is a no-op there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260315165907_auto'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    ALTER TABLE "guild_configs"
      ADD COLUMN IF NOT EXISTS "aiModerationCategoryThresholds" JSONB;
  END IF;
END
$$;
