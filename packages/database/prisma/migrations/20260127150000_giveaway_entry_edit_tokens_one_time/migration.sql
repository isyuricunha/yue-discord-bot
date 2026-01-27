-- AlterTable
ALTER TABLE "public"."giveaway_entry_edit_tokens" ADD COLUMN "usedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "giveaway_entry_edit_tokens_usedAt_idx" ON "public"."giveaway_entry_edit_tokens"("usedAt" ASC);
