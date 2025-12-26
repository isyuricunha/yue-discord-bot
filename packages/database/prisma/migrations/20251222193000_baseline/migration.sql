-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."giveaway_entries" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "choices" JSONB,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."giveaway_winners" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "prize" TEXT,
    "prizeIndex" INTEGER,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."giveaways" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "creatorId" TEXT NOT NULL,
    "requiredRoleId" TEXT,
    "emojiId" TEXT DEFAULT '🎉',
    "maxWinners" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'reaction',
    "availableItems" JSONB,
    "minChoices" INTEGER,
    "maxChoices" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."global_xp_members" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastMessageHash" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_xp_members_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."guild_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "modLogChannelId" TEXT,
    "giveawayChannelId" TEXT,
    "welcomeChannelId" TEXT,
    "muteRoleId" TEXT,
    "bannedWords" JSONB NOT NULL DEFAULT '[]',
    "wordFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wordFilterWhitelistChannels" JSONB NOT NULL DEFAULT '[]',
    "wordFilterWhitelistRoles" JSONB NOT NULL DEFAULT '[]',
    "capsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "capsThreshold" INTEGER NOT NULL DEFAULT 70,
    "capsMinLength" INTEGER NOT NULL DEFAULT 10,
    "capsAction" TEXT NOT NULL DEFAULT 'warn',
    "capsWhitelistChannels" JSONB NOT NULL DEFAULT '[]',
    "capsWhitelistRoles" JSONB NOT NULL DEFAULT '[]',
    "linkFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkBlockAll" BOOLEAN NOT NULL DEFAULT false,
    "bannedDomains" JSONB NOT NULL DEFAULT '[]',
    "allowedDomains" JSONB NOT NULL DEFAULT '[]',
    "linkAction" TEXT NOT NULL DEFAULT 'delete',
    "linkWhitelistChannels" JSONB NOT NULL DEFAULT '[]',
    "linkWhitelistRoles" JSONB NOT NULL DEFAULT '[]',
    "warnThresholds" JSONB NOT NULL DEFAULT '[]',
    "warnExpiration" INTEGER NOT NULL DEFAULT 30,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "prefix" TEXT NOT NULL DEFAULT '/',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_level_role_rewards" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "guild_level_role_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "guild_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_xp_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minMessageLength" INTEGER NOT NULL DEFAULT 5,
    "minUniqueLength" INTEGER NOT NULL DEFAULT 12,
    "typingCps" INTEGER NOT NULL DEFAULT 7,
    "xpDivisorMin" INTEGER NOT NULL DEFAULT 7,
    "xpDivisorMax" INTEGER NOT NULL DEFAULT 4,
    "xpCap" INTEGER NOT NULL DEFAULT 35,
    "ignoredChannelIds" JSONB NOT NULL DEFAULT '[]',
    "ignoredRoleIds" JSONB NOT NULL DEFAULT '[]',
    "roleXpMultipliers" JSONB NOT NULL DEFAULT '{}',
    "rewardMode" TEXT NOT NULL DEFAULT 'stack',
    "levelUpChannelId" TEXT,
    "levelUpMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_xp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_xp_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastMessageHash" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_xp_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "ownerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mod_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "duration" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mod_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "giveaway_entries_giveawayId_idx" ON "public"."giveaway_entries"("giveawayId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entries_giveawayId_userId_key" ON "public"."giveaway_entries"("giveawayId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "giveaway_winners_giveawayId_idx" ON "public"."giveaway_winners"("giveawayId" ASC);

-- CreateIndex
CREATE INDEX "giveaways_guildId_ended_idx" ON "public"."giveaways"("guildId" ASC, "ended" ASC);

-- CreateIndex
CREATE INDEX "global_xp_members_xp_idx" ON "public"."global_xp_members"("xp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_guildId_key" ON "public"."guild_configs"("guildId" ASC);

-- CreateIndex
CREATE INDEX "guild_level_role_rewards_guildId_level_idx" ON "public"."guild_level_role_rewards"("guildId" ASC, "level" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_level_role_rewards_guildId_level_key" ON "public"."guild_level_role_rewards"("guildId" ASC, "level" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_members_userId_guildId_key" ON "public"."guild_members"("userId" ASC, "guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_xp_configs_guildId_key" ON "public"."guild_xp_configs"("guildId" ASC);

-- CreateIndex
CREATE INDEX "guild_xp_members_guildId_xp_idx" ON "public"."guild_xp_members"("guildId" ASC, "xp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_xp_members_userId_guildId_key" ON "public"."guild_xp_members"("userId" ASC, "guildId" ASC);

-- CreateIndex
CREATE INDEX "mod_logs_guildId_createdAt_idx" ON "public"."mod_logs"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "mod_logs_userId_idx" ON "public"."mod_logs"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "public"."sessions"("token" ASC);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "public"."sessions"("userId" ASC);

-- AddForeignKey
ALTER TABLE "public"."giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."giveaway_winners" ADD CONSTRAINT "giveaway_winners_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."giveaways" ADD CONSTRAINT "giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_configs" ADD CONSTRAINT "guild_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_level_role_rewards" ADD CONSTRAINT "guild_level_role_rewards_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_members" ADD CONSTRAINT "guild_members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_xp_configs" ADD CONSTRAINT "guild_xp_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_xp_members" ADD CONSTRAINT "guild_xp_members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mod_logs" ADD CONSTRAINT "mod_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mod_logs" ADD CONSTRAINT "mod_logs_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "public"."guild_members"("userId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;
