-- CreateTable
CREATE TABLE "suggestion_configs" (
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
CREATE TABLE "suggestions" (
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
CREATE TABLE "suggestion_votes" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_configs_guildId_key" ON "suggestion_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_messageId_key" ON "suggestions"("messageId");

-- CreateIndex
CREATE INDEX "suggestions_guildId_status_createdAt_idx" ON "suggestions"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "suggestions_guildId_userId_createdAt_idx" ON "suggestions"("guildId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_guildId_sourceMessageId_key" ON "suggestions"("guildId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "suggestion_votes_suggestionId_idx" ON "suggestion_votes"("suggestionId");

-- CreateIndex
CREATE INDEX "suggestion_votes_userId_idx" ON "suggestion_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_votes_suggestionId_userId_key" ON "suggestion_votes"("suggestionId", "userId");

-- AddForeignKey
ALTER TABLE "suggestion_configs" ADD CONSTRAINT "suggestion_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
