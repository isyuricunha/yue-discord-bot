-- AlterTable
ALTER TABLE "waifu_rolls" ADD COLUMN "kind" TEXT;

UPDATE "waifu_rolls" SET "kind" = 'casar' WHERE "kind" IS NULL;

ALTER TABLE "waifu_rolls" ALTER COLUMN "kind" SET NOT NULL;

-- AlterTable
ALTER TABLE "waifu_user_states" ADD COLUMN "nextRerollAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "waifu_wishlists" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waifu_wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_wishlists_guildId_userId_characterId_key" ON "waifu_wishlists"("guildId", "userId", "characterId");

-- CreateIndex
CREATE INDEX "waifu_wishlists_guildId_userId_createdAt_idx" ON "waifu_wishlists"("guildId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "waifu_wishlists_guildId_characterId_idx" ON "waifu_wishlists"("guildId", "characterId");

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_nextRerollAt_idx" ON "waifu_user_states"("guildId", "nextRerollAt");

-- AddForeignKey
ALTER TABLE "waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
