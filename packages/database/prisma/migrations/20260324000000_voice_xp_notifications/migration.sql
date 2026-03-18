-- Add voice XP notifications enabled field to users table
ALTER TABLE "users" ADD COLUMN "voiceXpNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
