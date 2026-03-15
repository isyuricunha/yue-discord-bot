-- AlterTable
ALTER TABLE "guild_configs" ADD COLUMN     "muteRoleIds" JSONB NOT NULL DEFAULT '[]';
