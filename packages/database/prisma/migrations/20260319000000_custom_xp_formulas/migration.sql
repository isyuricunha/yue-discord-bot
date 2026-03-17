-- Add custom XP formulas fields to GuildXpConfig
ALTER TABLE "guild_xp_configs" ADD COLUMN "xpMode" TEXT NOT NULL DEFAULT 'formula';
ALTER TABLE "guild_xp_configs" ADD COLUMN "xpPerMessage" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "guild_xp_configs" ADD COLUMN "xpPerVoiceMinute" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "guild_xp_configs" ADD COLUMN "xpBonusMinLength" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "guild_xp_configs" ADD COLUMN "xpBonusAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "guild_xp_configs" ADD COLUMN "dailyXpBonusEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "guild_xp_configs" ADD COLUMN "dailyXpBonusAmount" INTEGER NOT NULL DEFAULT 0;
