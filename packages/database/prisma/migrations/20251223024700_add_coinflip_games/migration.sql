-- CreateTable
CREATE TABLE "coinflip_games" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "guildId" TEXT,
    "channelId" TEXT,
    "messageId" TEXT,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "betAmount" BIGINT NOT NULL,
    "challengerSide" TEXT NOT NULL,
    "winnerId" TEXT,
    "resultSide" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "coinflip_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coinflip_games_status_createdAt_idx" ON "coinflip_games"("status", "createdAt");

-- CreateIndex
CREATE INDEX "coinflip_games_challengerId_createdAt_idx" ON "coinflip_games"("challengerId", "createdAt");

-- CreateIndex
CREATE INDEX "coinflip_games_opponentId_createdAt_idx" ON "coinflip_games"("opponentId", "createdAt");

-- CreateIndex
CREATE INDEX "coinflip_games_winnerId_createdAt_idx" ON "coinflip_games"("winnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "coinflip_games" ADD CONSTRAINT "coinflip_games_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinflip_games" ADD CONSTRAINT "coinflip_games_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coinflip_games" ADD CONSTRAINT "coinflip_games_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
