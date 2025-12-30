-- AlterTable
ALTER TABLE "waifu_rolls" ADD COLUMN "desiredGender" TEXT;

-- CreateIndex
CREATE INDEX "waifu_rolls_guildId_desiredGender_createdAt_idx" ON "waifu_rolls"("guildId", "desiredGender", "createdAt");
