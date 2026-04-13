-- DropIndex
DROP INDEX "keyword_triggers_guildId_keyword_key";

-- AlterTable
ALTER TABLE "keyword_triggers" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "keyword" DROP NOT NULL;
