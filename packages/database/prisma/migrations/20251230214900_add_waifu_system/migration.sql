-- CreateTable
CREATE TABLE "waifu_characters" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameNative" TEXT,
    "imageUrl" TEXT NOT NULL,
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waifu_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waifu_claims" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waifu_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waifu_rolls" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "rolledByUserId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waifu_rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waifu_user_states" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nextClaimAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waifu_user_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_characters_source_sourceId_key" ON "waifu_characters"("source", "sourceId");

-- CreateIndex
CREATE INDEX "waifu_characters_name_idx" ON "waifu_characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "waifu_claims_guildId_characterId_key" ON "waifu_claims"("guildId", "characterId");

-- CreateIndex
CREATE INDEX "waifu_claims_guildId_userId_claimedAt_idx" ON "waifu_claims"("guildId", "userId", "claimedAt");

-- CreateIndex
CREATE INDEX "waifu_claims_userId_claimedAt_idx" ON "waifu_claims"("userId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "waifu_rolls_messageId_key" ON "waifu_rolls"("messageId");

-- CreateIndex
CREATE INDEX "waifu_rolls_guildId_rolledByUserId_createdAt_idx" ON "waifu_rolls"("guildId", "rolledByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "waifu_rolls_guildId_expiresAt_idx" ON "waifu_rolls"("guildId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "waifu_user_states_guildId_userId_key" ON "waifu_user_states"("guildId", "userId");

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_nextClaimAt_idx" ON "waifu_user_states"("guildId", "nextClaimAt");

-- AddForeignKey
ALTER TABLE "waifu_claims" ADD CONSTRAINT "waifu_claims_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_claims" ADD CONSTRAINT "waifu_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_claims" ADD CONSTRAINT "waifu_claims_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_rolls" ADD CONSTRAINT "waifu_rolls_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_rolls" ADD CONSTRAINT "waifu_rolls_rolledByUserId_fkey" FOREIGN KEY ("rolledByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_rolls" ADD CONSTRAINT "waifu_rolls_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_rolls" ADD CONSTRAINT "waifu_rolls_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_user_states" ADD CONSTRAINT "waifu_user_states_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waifu_user_states" ADD CONSTRAINT "waifu_user_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
