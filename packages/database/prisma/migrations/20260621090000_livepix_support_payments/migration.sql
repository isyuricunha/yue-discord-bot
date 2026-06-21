-- CreateEnum
CREATE TYPE "LivePixConnectionMode" AS ENUM ('OAUTH', 'OWNER');

-- CreateEnum
CREATE TYPE "LivePixConnectionStatus" AS ENUM ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "SupportPaymentStatus" AS ENUM ('CREATING', 'PENDING', 'CONFIRMED', 'FULFILLED', 'FAILED', 'MISMATCH', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupportEntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SupportRoleSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "LivePixWebhookEventStatus" AS ENUM ('RECEIVED', 'IGNORED', 'PROCESSED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE');

-- CreateTable
CREATE TABLE "guild_support_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL DEFAULT 'Apoios',
    "description" TEXT NOT NULL DEFAULT 'Escolha um plano para apoiar este servidor.',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "livePixConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_support_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guild_support_configs_reminderDaysBefore_check" CHECK ("reminderDaysBefore" >= 1 AND "reminderDaysBefore" <= 30)
);

-- CreateTable
CREATE TABLE "livepix_connections" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "mode" "LivePixConnectionMode" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerAccountUsername" TEXT,
    "providerAccountDisplayName" TEXT,
    "providerAccountAvatar" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "LivePixConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedByUserId" TEXT NOT NULL,
    "providerWebhookId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "livepix_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_plans" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_plans_amountCents_check" CHECK ("amountCents" > 0),
    CONSTRAINT "support_plans_durationDays_check" CHECK ("durationDays" > 0)
);

-- CreateTable
CREATE TABLE "support_payments" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "livePixConnectionId" TEXT,
    "providerAccountId" TEXT NOT NULL,
    "livePixReference" TEXT NOT NULL,
    "livePixPaymentId" TEXT,
    "checkoutUrlEncrypted" TEXT,
    "pendingKey" TEXT,
    "planNameSnapshot" TEXT NOT NULL,
    "planDescriptionSnapshot" TEXT,
    "amountCentsSnapshot" INTEGER NOT NULL,
    "durationDaysSnapshot" INTEGER NOT NULL,
    "roleIdSnapshot" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "SupportPaymentStatus" NOT NULL DEFAULT 'CREATING',
    "roleSyncStatus" "SupportRoleSyncStatus" NOT NULL DEFAULT 'PENDING',
    "providerCreatedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "mismatchCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_payments_amountCentsSnapshot_check" CHECK ("amountCentsSnapshot" > 0),
    CONSTRAINT "support_payments_durationDaysSnapshot_check" CHECK ("durationDaysSnapshot" > 0),
    CONSTRAINT "support_payments_currency_check" CHECK ("currency" = 'BRL')
);

-- CreateTable
CREATE TABLE "support_entitlements" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "latestPlanId" TEXT,
    "status" "SupportEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastReminderAt" TIMESTAMP(3),
    "lastRoleSyncAt" TIMESTAMP(3),
    "roleSyncStatus" "SupportRoleSyncStatus" NOT NULL DEFAULT 'PENDING',
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_entitlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_entitlements_expiresAt_check" CHECK ("expiresAt" > "startsAt")
);

-- CreateTable
CREATE TABLE "support_oauth_states" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "livepix_webhook_events" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "clientId" TEXT,
    "event" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "reference" TEXT,
    "guildId" TEXT,
    "supportPaymentId" TEXT,
    "status" "LivePixWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "livepix_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_audit_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT,
    "supportPaymentId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_support_configs_guildId_key" ON "guild_support_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_support_configs_livePixConnectionId_key" ON "guild_support_configs"("livePixConnectionId");

-- CreateIndex
CREATE INDEX "guild_support_configs_guildId_enabled_idx" ON "guild_support_configs"("guildId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "livepix_connections_guildId_key" ON "livepix_connections"("guildId");

-- CreateIndex
CREATE INDEX "livepix_connections_providerAccountId_idx" ON "livepix_connections"("providerAccountId");

-- CreateIndex
CREATE INDEX "livepix_connections_status_tokenExpiresAt_idx" ON "livepix_connections"("status", "tokenExpiresAt");

-- CreateIndex
CREATE INDEX "support_plans_guildId_archivedAt_enabled_sortOrder_idx" ON "support_plans"("guildId", "archivedAt", "enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "support_plans_guildId_roleId_idx" ON "support_plans"("guildId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "support_payments_publicId_key" ON "support_payments"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "support_payments_livePixReference_key" ON "support_payments"("livePixReference");

-- CreateIndex
CREATE UNIQUE INDEX "support_payments_livePixPaymentId_key" ON "support_payments"("livePixPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "support_payments_pendingKey_key" ON "support_payments"("pendingKey");

-- CreateIndex
CREATE INDEX "support_payments_guildId_userId_status_createdAt_idx" ON "support_payments"("guildId", "userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "support_payments_guildId_createdAt_idx" ON "support_payments"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "support_payments_status_createdAt_idx" ON "support_payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "support_payments_roleSyncStatus_updatedAt_idx" ON "support_payments"("roleSyncStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_entitlements_guildId_userId_roleId_key" ON "support_entitlements"("guildId", "userId", "roleId");

-- CreateIndex
CREATE INDEX "support_entitlements_guildId_status_expiresAt_idx" ON "support_entitlements"("guildId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "support_entitlements_guildId_userId_status_idx" ON "support_entitlements"("guildId", "userId", "status");

-- CreateIndex
CREATE INDEX "support_entitlements_roleSyncStatus_updatedAt_idx" ON "support_entitlements"("roleSyncStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_oauth_states_stateHash_key" ON "support_oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "support_oauth_states_guildId_userId_expiresAt_idx" ON "support_oauth_states"("guildId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "support_oauth_states_expiresAt_idx" ON "support_oauth_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "livepix_webhook_events_dedupeKey_key" ON "livepix_webhook_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "livepix_webhook_events_guildId_createdAt_idx" ON "livepix_webhook_events"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "livepix_webhook_events_reference_idx" ON "livepix_webhook_events"("reference");

-- CreateIndex
CREATE INDEX "livepix_webhook_events_status_createdAt_idx" ON "livepix_webhook_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "support_audit_events_guildId_createdAt_idx" ON "support_audit_events"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "support_audit_events_guildId_action_createdAt_idx" ON "support_audit_events"("guildId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "support_audit_events_supportPaymentId_idx" ON "support_audit_events"("supportPaymentId");

-- AddForeignKey
ALTER TABLE "guild_support_configs" ADD CONSTRAINT "guild_support_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_support_configs" ADD CONSTRAINT "guild_support_configs_livePixConnectionId_fkey" FOREIGN KEY ("livePixConnectionId") REFERENCES "livepix_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livepix_connections" ADD CONSTRAINT "livepix_connections_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_plans" ADD CONSTRAINT "support_plans_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "support_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_livePixConnectionId_fkey" FOREIGN KEY ("livePixConnectionId") REFERENCES "livepix_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_entitlements" ADD CONSTRAINT "support_entitlements_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_entitlements" ADD CONSTRAINT "support_entitlements_latestPlanId_fkey" FOREIGN KEY ("latestPlanId") REFERENCES "support_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_oauth_states" ADD CONSTRAINT "support_oauth_states_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livepix_webhook_events" ADD CONSTRAINT "livepix_webhook_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livepix_webhook_events" ADD CONSTRAINT "livepix_webhook_events_supportPaymentId_fkey" FOREIGN KEY ("supportPaymentId") REFERENCES "support_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_audit_events" ADD CONSTRAINT "support_audit_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_audit_events" ADD CONSTRAINT "support_audit_events_supportPaymentId_fkey" FOREIGN KEY ("supportPaymentId") REFERENCES "support_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
