-- Backfill existing single mute role into the new array column
UPDATE "guild_configs"
SET "muteRoleIds" = jsonb_build_array("muteRoleId")
WHERE "muteRoleId" IS NOT NULL
  AND jsonb_array_length("muteRoleIds") = 0;
