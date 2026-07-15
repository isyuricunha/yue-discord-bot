-- AlterTable
ALTER TABLE "bot_settings"
ADD COLUMN     "customProviderReasoningMode" TEXT NOT NULL DEFAULT 'omit',
ADD COLUMN     "panelAiFallbackEnabled" BOOLEAN NOT NULL DEFAULT false;
