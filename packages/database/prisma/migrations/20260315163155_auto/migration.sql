-- AlterTable
ALTER TABLE "bot_settings" ADD COLUMN     "blockedGuildIds" JSONB NOT NULL DEFAULT '[]';
