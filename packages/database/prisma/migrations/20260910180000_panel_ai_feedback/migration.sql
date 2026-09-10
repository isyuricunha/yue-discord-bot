-- Create panel_ai_feedback: per-turn user feedback (thumbs up/down) for the
-- panel AI assistant. Additive table; no data migration required.
CREATE TABLE "panel_ai_feedback" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_ai_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "panel_ai_feedback_guildId_userId_turnId_key" ON "panel_ai_feedback"("guildId", "userId", "turnId");
CREATE INDEX "panel_ai_feedback_guildId_createdAt_idx" ON "panel_ai_feedback"("guildId", "createdAt");
