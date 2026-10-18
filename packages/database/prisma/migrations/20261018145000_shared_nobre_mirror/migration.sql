CREATE TABLE "shared_nobre_mirrors" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "discordId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "linked" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shared_nobre_mirrors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shared_nobre_mirrors_guildId_discordId_key"
 ON "shared_nobre_mirrors"("guildId","discordId");
CREATE INDEX "shared_nobre_mirrors_guildId_linked_expiresAt_idx"
 ON "shared_nobre_mirrors"("guildId","linked","expiresAt");
