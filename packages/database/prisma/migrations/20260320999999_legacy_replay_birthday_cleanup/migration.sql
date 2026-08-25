-- Remove the transient replay-only table before the real birthday migration creates it.
-- Existing databases already have the real birthday migration and therefore no-op here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260321000000_birthday_system'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    DROP TABLE IF EXISTS "user_birthdays";
  END IF;
END
$$;
