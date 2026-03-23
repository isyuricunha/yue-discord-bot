-- AlterTable
ALTER TABLE "keyword_triggers" ADD COLUMN     "content" TEXT,
ALTER COLUMN "mediaUrl" DROP NOT NULL;
