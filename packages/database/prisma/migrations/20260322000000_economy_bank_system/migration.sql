-- Add bank fields to Wallet table
ALTER TABLE "wallets" ADD COLUMN "bankBalance" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN "lastInterestAt" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "wallets" ADD COLUMN "totalInterestEarned" BIGINT NOT NULL DEFAULT 0;
