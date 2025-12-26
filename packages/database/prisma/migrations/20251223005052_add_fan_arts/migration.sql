-- CreateTable
CREATE TABLE "fan_arts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceChannelId" TEXT,
    "sourceMessageId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageName" TEXT,
    "imageSize" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "tags" JSONB,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fan_arts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fan_arts_status_createdAt_idx" ON "fan_arts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "fan_arts_userId_createdAt_idx" ON "fan_arts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "fan_arts" ADD CONSTRAINT "fan_arts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
