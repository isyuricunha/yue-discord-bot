-- CreateTable
CREATE TABLE "bot_settings" (
    "id" TEXT NOT NULL,
    "presenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "presenceStatus" TEXT NOT NULL DEFAULT 'online',
    "activityType" TEXT,
    "activityName" TEXT,
    "activityUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_settings_pkey" PRIMARY KEY ("id")
);
