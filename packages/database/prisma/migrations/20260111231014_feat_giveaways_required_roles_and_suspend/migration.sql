-- AlterTable
ALTER TABLE "giveaways" ADD COLUMN     "requiredRoleIds" JSONB,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;
