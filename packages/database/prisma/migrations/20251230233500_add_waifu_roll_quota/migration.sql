-- AlterTable
ALTER TABLE "waifu_user_states" ADD COLUMN "rollWindowStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "waifu_user_states" ADD COLUMN "rollUses" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_userId_rollWindowStartedAt_idx" ON "waifu_user_states"("guildId", "userId", "rollWindowStartedAt");
