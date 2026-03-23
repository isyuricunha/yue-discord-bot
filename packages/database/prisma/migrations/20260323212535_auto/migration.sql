-- CreateTable
CREATE TABLE "keyword_triggers" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "channelId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_triggers_guildId_idx" ON "keyword_triggers"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_triggers_guildId_keyword_key" ON "keyword_triggers"("guildId", "keyword");

-- AddForeignKey
ALTER TABLE "keyword_triggers" ADD CONSTRAINT "keyword_triggers_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
