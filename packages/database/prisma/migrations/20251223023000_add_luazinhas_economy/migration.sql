-- CreateTable
CREATE TABLE "wallets" (
    "userId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "luazinha_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "guildId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luazinha_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "luazinha_transactions_type_createdAt_idx" ON "luazinha_transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "luazinha_transactions_fromUserId_createdAt_idx" ON "luazinha_transactions"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "luazinha_transactions_toUserId_createdAt_idx" ON "luazinha_transactions"("toUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luazinha_transactions" ADD CONSTRAINT "luazinha_transactions_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luazinha_transactions" ADD CONSTRAINT "luazinha_transactions_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
