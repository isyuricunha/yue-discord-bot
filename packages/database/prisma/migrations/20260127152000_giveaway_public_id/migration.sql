-- AlterTable
ALTER TABLE "public"."giveaways" ADD COLUMN "publicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "giveaways_publicId_key" ON "public"."giveaways"("publicId" ASC);

-- CreateIndex
CREATE INDEX "giveaways_publicId_idx" ON "public"."giveaways"("publicId" ASC);
