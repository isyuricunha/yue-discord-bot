-- CreateUserBirthdayMigration
-- Add birthday support to the bot

-- Create user_birthdays table
CREATE TABLE "user_birthdays" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "userId" TEXT NOT NULL UNIQUE,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create index for querying birthdays by day/month
CREATE INDEX "user_birthdays_day_month_idx" ON "user_birthdays"("day", "month");

-- Add birthday configuration to guild_configs
ALTER TABLE "guild_configs" ADD COLUMN "birthdayChannelId" TEXT;
ALTER TABLE "guild_configs" ADD COLUMN "birthdayRoleId" TEXT;
ALTER TABLE "guild_configs" ADD COLUMN "birthdayEnabled" BOOLEAN NOT NULL DEFAULT true;
