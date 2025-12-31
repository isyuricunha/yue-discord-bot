-- AlterTable
ALTER TABLE "waifu_characters" ADD COLUMN "favourites" INTEGER;
ALTER TABLE "waifu_characters" ADD COLUMN "value" INTEGER;

-- AlterTable
ALTER TABLE "waifu_claims" ADD COLUMN "valueAtClaim" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "waifu_user_states" ADD COLUMN "totalValue" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "waifu_characters_value_idx" ON "waifu_characters"("value");

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_totalValue_idx" ON "waifu_user_states"("guildId", "totalValue");
