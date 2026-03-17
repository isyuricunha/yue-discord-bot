-- AlterTable
ALTER TABLE "guild_xp_configs" ADD COLUMN     "levelUpEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "guild_anti_raid_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "joinThreshold" INTEGER NOT NULL DEFAULT 10,
    "joinTimeWindow" INTEGER NOT NULL DEFAULT 60,
    "action" TEXT NOT NULL DEFAULT 'mute',
    "duration" INTEGER NOT NULL DEFAULT 10,
    "exemptRoles" JSONB NOT NULL DEFAULT '[]',
    "exemptChannels" JSONB NOT NULL DEFAULT '[]',
    "cooldown" INTEGER NOT NULL DEFAULT 300,
    "notificationChannelId" TEXT,
    "raidActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRaidAt" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_anti_raid_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "multiVote" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIds" JSONB NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_rewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastClaimDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "totalClaims" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_daily_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_daily_reward_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rewardAmount" BIGINT NOT NULL DEFAULT 0,
    "streakBonus" BIGINT NOT NULL DEFAULT 0,
    "maxStreakBonus" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_daily_reward_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_afks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAfk" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_afks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_anti_raid_configs_guildId_key" ON "guild_anti_raid_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "polls_messageId_key" ON "polls"("messageId");

-- CreateIndex
CREATE INDEX "polls_guildId_ended_idx" ON "polls"("guildId", "ended");

-- CreateIndex
CREATE INDEX "polls_endsAt_idx" ON "polls"("endsAt");

-- CreateIndex
CREATE INDEX "poll_votes_pollId_idx" ON "poll_votes"("pollId");

-- CreateIndex
CREATE INDEX "poll_votes_userId_idx" ON "poll_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");

-- CreateIndex
CREATE INDEX "user_daily_rewards_userId_idx" ON "user_daily_rewards"("userId");

-- CreateIndex
CREATE INDEX "user_daily_rewards_lastClaimDate_idx" ON "user_daily_rewards"("lastClaimDate");

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_rewards_userId_key" ON "user_daily_rewards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_daily_reward_configs_guildId_key" ON "guild_daily_reward_configs"("guildId");

-- CreateIndex
CREATE INDEX "user_afks_guildId_idx" ON "user_afks"("guildId");

-- CreateIndex
CREATE INDEX "user_afks_userId_idx" ON "user_afks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_afks_userId_guildId_key" ON "user_afks"("userId", "guildId");

-- AddForeignKey
ALTER TABLE "guild_anti_raid_configs" ADD CONSTRAINT "guild_anti_raid_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_rewards" ADD CONSTRAINT "user_daily_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_daily_reward_configs" ADD CONSTRAINT "guild_daily_reward_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
