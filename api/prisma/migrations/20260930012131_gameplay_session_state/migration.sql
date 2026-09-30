-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "currentHintUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentServedAt" TIMESTAMP(3),
ADD COLUMN     "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
