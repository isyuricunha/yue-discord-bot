-- Tracks the latest release tag already turned into a Yue announcement.
ALTER TABLE "bot_settings" ADD COLUMN "lastAnnouncedReleaseTag" TEXT;
