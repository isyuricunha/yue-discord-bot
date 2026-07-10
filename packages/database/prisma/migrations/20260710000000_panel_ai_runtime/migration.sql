ALTER TABLE "bot_settings"
ADD COLUMN "panelAiProvider" TEXT NOT NULL DEFAULT 'mistral',
ADD COLUMN "customProviderModel" TEXT,
ADD COLUMN "panelAiSensitiveContextEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "customProviderModelCatalog" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "customProviderModelCatalogSyncedAt" TIMESTAMP(3),
ADD COLUMN "customProviderModelCatalogError" TEXT,
ADD COLUMN "panelAiConversationVersion" INTEGER NOT NULL DEFAULT 1;
