-- CreateTable
CREATE TABLE "public"."giveaway_entry_edit_tokens" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giveaway_entry_edit_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entry_edit_tokens_token_key" ON "public"."giveaway_entry_edit_tokens"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entry_edit_tokens_giveawayId_userId_key" ON "public"."giveaway_entry_edit_tokens"("giveawayId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "giveaway_entry_edit_tokens_expiresAt_idx" ON "public"."giveaway_entry_edit_tokens"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "giveaway_entry_edit_tokens_giveawayId_idx" ON "public"."giveaway_entry_edit_tokens"("giveawayId" ASC);

-- AddForeignKey
ALTER TABLE "public"."giveaway_entry_edit_tokens" ADD CONSTRAINT "giveaway_entry_edit_tokens_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
