-- CreateTable
CREATE TABLE "reaction_role_panels" (
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
CREATE TABLE "reaction_role_items" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_role_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reaction_role_panels_guildId_createdAt_idx" ON "reaction_role_panels"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_role_items_panelId_roleId_key" ON "reaction_role_items"("panelId", "roleId");

-- CreateIndex
CREATE INDEX "reaction_role_items_panelId_idx" ON "reaction_role_items"("panelId");

-- AddForeignKey
ALTER TABLE "reaction_role_panels" ADD CONSTRAINT "reaction_role_panels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaction_role_items" ADD CONSTRAINT "reaction_role_items_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "reaction_role_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
