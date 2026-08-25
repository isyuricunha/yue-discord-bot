-- Persist anti-raid lifecycle and exact @everyone permission snapshots.
ALTER TABLE "guild_anti_raid_configs"
  ADD COLUMN "raidEndsAt" TIMESTAMP(3),
  ADD COLUMN "lockedEveryonePermissions" TEXT;

CREATE INDEX "guild_anti_raid_configs_raid_recovery_idx"
  ON "guild_anti_raid_configs"("raidActive", "raidEndsAt");
