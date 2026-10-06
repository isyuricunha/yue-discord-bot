-- AI moderation provider selection and automatic fallback.
-- Additive columns; existing guilds keep OpenAI-only behavior (provider default
-- "openai", fallback off).
ALTER TABLE "GuildConfig" ADD COLUMN "aiModerationProvider" TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE "GuildConfig" ADD COLUMN "aiModerationFallback" BOOLEAN NOT NULL DEFAULT false;
