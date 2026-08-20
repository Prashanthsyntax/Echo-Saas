/*
  Warnings:

  - A unique constraint covering the columns `[userId,sourceDoc,chunkHash]` on the table `ChunkScore` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chunkHash` to the `ChunkScore` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ChunkScore_userId_sourceDoc_chunkText_key";

-- AlterTable
ALTER TABLE "ChunkScore" ADD COLUMN     "chunkHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChunkScore_userId_sourceDoc_chunkHash_key" ON "ChunkScore"("userId", "sourceDoc", "chunkHash");
