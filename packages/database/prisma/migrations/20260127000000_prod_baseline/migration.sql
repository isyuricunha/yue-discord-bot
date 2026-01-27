-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AniListMediaType" AS ENUM ('anime', 'manga');

-- CreateEnum
CREATE TYPE "public"."GuildCommandType" AS ENUM ('slash', 'context');

-- CreateTable
CREATE TABLE "public"."anilist_notification_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anilist_notification_settings" (
    "userId" TEXT NOT NULL,
    "dmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_notification_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."anilist_watchlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" "public"."AniListMediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "siteUrl" TEXT,
    "imageUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextAiringAt" INTEGER,
    "nextAiringEpisode" INTEGER,
    "lastNotifiedAiringAt" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anilist_watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "targetChannelId" TEXT,
    "targetMessageId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bot_settings" (
    "id" TEXT NOT NULL,
    "presenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "presenceStatus" TEXT NOT NULL DEFAULT 'online',
    "activityType" TEXT,
    "activityName" TEXT,
    "activityUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appDescription" TEXT,

    CONSTRAINT "bot_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coinflip_games" (
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
    "serverSeed" TEXT,
    "serverSeedHash" TEXT,

    CONSTRAINT "coinflip_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fan_arts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceChannelId" TEXT,
    "sourceMessageId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageName" TEXT,
    "imageSize" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "tags" JSONB,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fan_arts_pkey" PRIMARY KEY ("id")
);

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
    "requiredRoleIds" JSONB,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "roleChances" JSONB,

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
CREATE TABLE "public"."guild_autorole_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "onlyAfterFirstMessage" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_autorole_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_autorole_pendings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "waitForFirstMessage" BOOLEAN NOT NULL DEFAULT false,
    "executeAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_autorole_pendings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_autorole_roles" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "guild_autorole_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guild_command_overrides" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandType" "public"."GuildCommandType" NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_command_overrides_pkey" PRIMARY KEY ("id")
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
    "leaveChannelId" TEXT,
    "leaveMessage" TEXT,
    "welcomeMessage" TEXT,
    "modLogMessage" TEXT,
    "announcementChannelId" TEXT,

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
CREATE TABLE "public"."inventory_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "purchaseId" TEXT,
    "shopItemId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "usedQuantity" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiredHandledAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."luazinha_transactions" (
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
CREATE TABLE "public"."owner_action_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "preview" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "owner_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "shopItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reaction_role_items" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_role_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reaction_role_panels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'multiple',
    "channelId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reaction_role_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "reminder24hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder1hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder10mSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder24hAt" TIMESTAMP(3),
    "reminder1hAt" TIMESTAMP(3),
    "reminder10mAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "public"."shop_items" (
    "id" TEXT NOT NULL,
    "guildId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."starboard_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."starboard_posts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "starboardChannelId" TEXT NOT NULL,
    "starboardMessageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starboard_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suggestion_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "logChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suggestion_votes" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suggestions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "logChannelId" TEXT,
    "supportRoleIds" JSONB NOT NULL DEFAULT '[]',
    "panelChannelId" TEXT,
    "panelMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waifu_characters" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameNative" TEXT,
    "imageUrl" TEXT NOT NULL,
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "favourites" INTEGER,
    "value" INTEGER,

    CONSTRAINT "waifu_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waifu_claims" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueAtClaim" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "waifu_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waifu_rolls" (
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
    "kind" TEXT NOT NULL,
    "desiredGender" TEXT,

    CONSTRAINT "waifu_rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waifu_user_states" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nextClaimAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextRerollAt" TIMESTAMP(3),
    "rollWindowStartedAt" TIMESTAMP(3),
    "rollUses" INTEGER NOT NULL DEFAULT 0,
    "totalValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "waifu_user_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waifu_wishlists" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waifu_wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wallets" (
    "userId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "anilist_notification_channels_guildId_idx" ON "public"."anilist_notification_channels"("guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anilist_notification_channels_userId_guildId_key" ON "public"."anilist_notification_channels"("userId" ASC, "guildId" ASC);

-- CreateIndex
CREATE INDEX "anilist_notification_channels_userId_idx" ON "public"."anilist_notification_channels"("userId" ASC);

-- CreateIndex
CREATE INDEX "anilist_watchlist_items_mediaType_enabled_nextCheckAt_idx" ON "public"."anilist_watchlist_items"("mediaType" ASC, "enabled" ASC, "nextCheckAt" ASC);

-- CreateIndex
CREATE INDEX "anilist_watchlist_items_userId_mediaType_createdAt_idx" ON "public"."anilist_watchlist_items"("userId" ASC, "mediaType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anilist_watchlist_items_userId_mediaType_mediaId_key" ON "public"."anilist_watchlist_items"("userId" ASC, "mediaType" ASC, "mediaId" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_guildId_action_createdAt_idx" ON "public"."audit_logs"("guildId" ASC, "action" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_guildId_actorUserId_createdAt_idx" ON "public"."audit_logs"("guildId" ASC, "actorUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_guildId_createdAt_idx" ON "public"."audit_logs"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_guildId_targetChannelId_createdAt_idx" ON "public"."audit_logs"("guildId" ASC, "targetChannelId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_guildId_targetUserId_createdAt_idx" ON "public"."audit_logs"("guildId" ASC, "targetUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "badges_category_idx" ON "public"."badges"("category" ASC);

-- CreateIndex
CREATE INDEX "coinflip_games_challengerId_createdAt_idx" ON "public"."coinflip_games"("challengerId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "coinflip_games_opponentId_createdAt_idx" ON "public"."coinflip_games"("opponentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "coinflip_games_status_createdAt_idx" ON "public"."coinflip_games"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "coinflip_games_winnerId_createdAt_idx" ON "public"."coinflip_games"("winnerId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "fan_arts_status_createdAt_idx" ON "public"."fan_arts"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "fan_arts_userId_createdAt_idx" ON "public"."fan_arts"("userId" ASC, "createdAt" ASC);

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
CREATE UNIQUE INDEX "guild_autorole_configs_guildId_key" ON "public"."guild_autorole_configs"("guildId" ASC);

-- CreateIndex
CREATE INDEX "guild_autorole_pendings_guildId_executeAt_idx" ON "public"."guild_autorole_pendings"("guildId" ASC, "executeAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_autorole_pendings_guildId_userId_key" ON "public"."guild_autorole_pendings"("guildId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "guild_autorole_roles_configId_idx" ON "public"."guild_autorole_roles"("configId" ASC);

-- CreateIndex
CREATE INDEX "guild_autorole_roles_guildId_idx" ON "public"."guild_autorole_roles"("guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_autorole_roles_guildId_roleId_key" ON "public"."guild_autorole_roles"("guildId" ASC, "roleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "guild_command_overrides_guildId_commandType_commandName_key" ON "public"."guild_command_overrides"("guildId" ASC, "commandType" ASC, "commandName" ASC);

-- CreateIndex
CREATE INDEX "guild_command_overrides_guildId_idx" ON "public"."guild_command_overrides"("guildId" ASC);

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
CREATE INDEX "inventory_items_userId_createdAt_idx" ON "public"."inventory_items"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "inventory_items_userId_guildId_kind_expiresAt_idx" ON "public"."inventory_items"("userId" ASC, "guildId" ASC, "kind" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "luazinha_transactions_fromUserId_createdAt_idx" ON "public"."luazinha_transactions"("fromUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "luazinha_transactions_toUserId_createdAt_idx" ON "public"."luazinha_transactions"("toUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "luazinha_transactions_type_createdAt_idx" ON "public"."luazinha_transactions"("type" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "mod_logs_guildId_createdAt_idx" ON "public"."mod_logs"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "mod_logs_userId_idx" ON "public"."mod_logs"("userId" ASC);

-- CreateIndex
CREATE INDEX "owner_action_logs_status_createdAt_idx" ON "public"."owner_action_logs"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "owner_action_logs_type_createdAt_idx" ON "public"."owner_action_logs"("type" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "purchases_guildId_createdAt_idx" ON "public"."purchases"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "purchases_userId_createdAt_idx" ON "public"."purchases"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "reaction_role_items_panelId_idx" ON "public"."reaction_role_items"("panelId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "reaction_role_items_panelId_roleId_key" ON "public"."reaction_role_items"("panelId" ASC, "roleId" ASC);

-- CreateIndex
CREATE INDEX "reaction_role_panels_guildId_createdAt_idx" ON "public"."reaction_role_panels"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "scheduled_events_guildId_ended_cancelled_startsAt_idx" ON "public"."scheduled_events"("guildId" ASC, "ended" ASC, "cancelled" ASC, "startsAt" ASC);

-- CreateIndex
CREATE INDEX "scheduled_events_guildId_startsAt_idx" ON "public"."scheduled_events"("guildId" ASC, "startsAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "public"."sessions"("token" ASC);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "public"."sessions"("userId" ASC);

-- CreateIndex
CREATE INDEX "shop_items_guildId_enabled_idx" ON "public"."shop_items"("guildId" ASC, "enabled" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "starboard_configs_guildId_key" ON "public"."starboard_configs"("guildId" ASC);

-- CreateIndex
CREATE INDEX "starboard_posts_guildId_createdAt_idx" ON "public"."starboard_posts"("guildId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "starboard_posts_guildId_sourceMessageId_key" ON "public"."starboard_posts"("guildId" ASC, "sourceMessageId" ASC);

-- CreateIndex
CREATE INDEX "starboard_posts_guildId_starCount_idx" ON "public"."starboard_posts"("guildId" ASC, "starCount" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "starboard_posts_starboardMessageId_key" ON "public"."starboard_posts"("starboardMessageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_configs_guildId_key" ON "public"."suggestion_configs"("guildId" ASC);

-- CreateIndex
CREATE INDEX "suggestion_votes_suggestionId_idx" ON "public"."suggestion_votes"("suggestionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_votes_suggestionId_userId_key" ON "public"."suggestion_votes"("suggestionId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "suggestion_votes_userId_idx" ON "public"."suggestion_votes"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_guildId_sourceMessageId_key" ON "public"."suggestions"("guildId" ASC, "sourceMessageId" ASC);

-- CreateIndex
CREATE INDEX "suggestions_guildId_status_createdAt_idx" ON "public"."suggestions"("guildId" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "suggestions_guildId_userId_createdAt_idx" ON "public"."suggestions"("guildId" ASC, "userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_messageId_key" ON "public"."suggestions"("messageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_configs_guildId_key" ON "public"."ticket_configs"("guildId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channelId_key" ON "public"."tickets"("channelId" ASC);

-- CreateIndex
CREATE INDEX "tickets_guildId_status_createdAt_idx" ON "public"."tickets"("guildId" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "tickets_guildId_userId_createdAt_idx" ON "public"."tickets"("guildId" ASC, "userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "user_badges_badgeId_idx" ON "public"."user_badges"("badgeId" ASC);

-- CreateIndex
CREATE INDEX "user_badges_expiresAt_idx" ON "public"."user_badges"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "public"."user_badges"("userId" ASC, "badgeId" ASC);

-- CreateIndex
CREATE INDEX "user_badges_userId_idx" ON "public"."user_badges"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "public"."user_profiles"("userId" ASC);

-- CreateIndex
CREATE INDEX "waifu_characters_name_idx" ON "public"."waifu_characters"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_characters_source_sourceId_key" ON "public"."waifu_characters"("source" ASC, "sourceId" ASC);

-- CreateIndex
CREATE INDEX "waifu_characters_value_idx" ON "public"."waifu_characters"("value" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_claims_guildId_characterId_key" ON "public"."waifu_claims"("guildId" ASC, "characterId" ASC);

-- CreateIndex
CREATE INDEX "waifu_claims_guildId_userId_claimedAt_idx" ON "public"."waifu_claims"("guildId" ASC, "userId" ASC, "claimedAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_claims_userId_claimedAt_idx" ON "public"."waifu_claims"("userId" ASC, "claimedAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_rolls_guildId_expiresAt_idx" ON "public"."waifu_rolls"("guildId" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_rolls_guildId_rolledByUserId_createdAt_idx" ON "public"."waifu_rolls"("guildId" ASC, "rolledByUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_rolls_messageId_key" ON "public"."waifu_rolls"("messageId" ASC);

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_nextClaimAt_idx" ON "public"."waifu_user_states"("guildId" ASC, "nextClaimAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_nextRerollAt_idx" ON "public"."waifu_user_states"("guildId" ASC, "nextRerollAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_totalValue_idx" ON "public"."waifu_user_states"("guildId" ASC, "totalValue" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_user_states_guildId_userId_key" ON "public"."waifu_user_states"("guildId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "waifu_user_states_guildId_userId_rollWindowStartedAt_idx" ON "public"."waifu_user_states"("guildId" ASC, "userId" ASC, "rollWindowStartedAt" ASC);

-- CreateIndex
CREATE INDEX "waifu_wishlists_guildId_characterId_idx" ON "public"."waifu_wishlists"("guildId" ASC, "characterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waifu_wishlists_guildId_userId_characterId_key" ON "public"."waifu_wishlists"("guildId" ASC, "userId" ASC, "characterId" ASC);

-- CreateIndex
CREATE INDEX "waifu_wishlists_guildId_userId_createdAt_idx" ON "public"."waifu_wishlists"("guildId" ASC, "userId" ASC, "createdAt" ASC);

-- AddForeignKey
ALTER TABLE "public"."anilist_notification_channels" ADD CONSTRAINT "anilist_notification_channels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anilist_notification_channels" ADD CONSTRAINT "anilist_notification_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anilist_notification_settings" ADD CONSTRAINT "anilist_notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anilist_watchlist_items" ADD CONSTRAINT "anilist_watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coinflip_games" ADD CONSTRAINT "coinflip_games_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coinflip_games" ADD CONSTRAINT "coinflip_games_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coinflip_games" ADD CONSTRAINT "coinflip_games_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fan_arts" ADD CONSTRAINT "fan_arts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."giveaway_winners" ADD CONSTRAINT "giveaway_winners_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."giveaways" ADD CONSTRAINT "giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_autorole_configs" ADD CONSTRAINT "guild_autorole_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_autorole_pendings" ADD CONSTRAINT "guild_autorole_pendings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_autorole_roles" ADD CONSTRAINT "guild_autorole_roles_configId_fkey" FOREIGN KEY ("configId") REFERENCES "public"."guild_autorole_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_autorole_roles" ADD CONSTRAINT "guild_autorole_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guild_command_overrides" ADD CONSTRAINT "guild_command_overrides_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "public"."purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "public"."shop_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."luazinha_transactions" ADD CONSTRAINT "luazinha_transactions_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."luazinha_transactions" ADD CONSTRAINT "luazinha_transactions_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mod_logs" ADD CONSTRAINT "mod_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mod_logs" ADD CONSTRAINT "mod_logs_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "public"."guild_members"("userId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchases" ADD CONSTRAINT "purchases_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchases" ADD CONSTRAINT "purchases_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "public"."shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reaction_role_items" ADD CONSTRAINT "reaction_role_items_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "public"."reaction_role_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reaction_role_panels" ADD CONSTRAINT "reaction_role_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_events" ADD CONSTRAINT "scheduled_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shop_items" ADD CONSTRAINT "shop_items_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."starboard_configs" ADD CONSTRAINT "starboard_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."starboard_posts" ADD CONSTRAINT "starboard_posts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suggestion_configs" ADD CONSTRAINT "suggestion_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suggestion_votes" ADD CONSTRAINT "suggestion_votes_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "public"."suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suggestions" ADD CONSTRAINT "suggestions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_configs" ADD CONSTRAINT "ticket_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_claims" ADD CONSTRAINT "waifu_claims_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_claims" ADD CONSTRAINT "waifu_claims_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_claims" ADD CONSTRAINT "waifu_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_rolls" ADD CONSTRAINT "waifu_rolls_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_rolls" ADD CONSTRAINT "waifu_rolls_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_rolls" ADD CONSTRAINT "waifu_rolls_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_rolls" ADD CONSTRAINT "waifu_rolls_rolledByUserId_fkey" FOREIGN KEY ("rolledByUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_user_states" ADD CONSTRAINT "waifu_user_states_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_user_states" ADD CONSTRAINT "waifu_user_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."waifu_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waifu_wishlists" ADD CONSTRAINT "waifu_wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
