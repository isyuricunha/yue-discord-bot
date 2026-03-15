ALTER TABLE "guild_configs" ADD COLUMN "aiModerationThresholds" JSONB NOT NULL DEFAULT '{}'::jsonb;
