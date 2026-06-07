ALTER TABLE "guild_configs"
ADD COLUMN "linkTimeoutDuration" TEXT NOT NULL DEFAULT '5m',
ADD COLUMN "linkNoRoleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "linkNoRoleAction" TEXT NOT NULL DEFAULT 'mute',
ADD COLUMN "linkNoRoleTimeoutDuration" TEXT NOT NULL DEFAULT '10m',
ADD COLUMN "linkNotifyEnabled" BOOLEAN NOT NULL DEFAULT true;
