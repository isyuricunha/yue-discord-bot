-- CreateTable
CREATE TABLE "owner_action_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "preview" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "owner_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_action_logs_type_createdAt_idx" ON "owner_action_logs"("type", "createdAt");

-- CreateIndex
CREATE INDEX "owner_action_logs_status_createdAt_idx" ON "owner_action_logs"("status", "createdAt");
