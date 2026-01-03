-- CreateTable
CREATE TABLE "audit_logs" (
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

-- CreateIndex
CREATE INDEX "audit_logs_guildId_createdAt_idx" ON "audit_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_action_createdAt_idx" ON "audit_logs"("guildId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_actorUserId_createdAt_idx" ON "audit_logs"("guildId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_targetUserId_createdAt_idx" ON "audit_logs"("guildId", "targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_targetChannelId_createdAt_idx" ON "audit_logs"("guildId", "targetChannelId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
