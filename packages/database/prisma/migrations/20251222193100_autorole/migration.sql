-- CreateTable
CREATE TABLE "guild_autorole_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "onlyAfterFirstMessage" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_autorole_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_autorole_roles" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "guild_autorole_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_autorole_pendings" (
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

-- CreateIndex
CREATE UNIQUE INDEX "guild_autorole_configs_guildId_key" ON "guild_autorole_configs"("guildId");

-- CreateIndex
CREATE INDEX "guild_autorole_roles_configId_idx" ON "guild_autorole_roles"("configId");

-- CreateIndex
CREATE INDEX "guild_autorole_roles_guildId_idx" ON "guild_autorole_roles"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_autorole_roles_guildId_roleId_key" ON "guild_autorole_roles"("guildId", "roleId");

-- CreateIndex
CREATE INDEX "guild_autorole_pendings_guildId_executeAt_idx" ON "guild_autorole_pendings"("guildId", "executeAt");

-- CreateIndex
CREATE UNIQUE INDEX "guild_autorole_pendings_guildId_userId_key" ON "guild_autorole_pendings"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "guild_autorole_configs" ADD CONSTRAINT "guild_autorole_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_autorole_roles" ADD CONSTRAINT "guild_autorole_roles_configId_fkey" FOREIGN KEY ("configId") REFERENCES "guild_autorole_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_autorole_roles" ADD CONSTRAINT "guild_autorole_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_autorole_pendings" ADD CONSTRAINT "guild_autorole_pendings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
