-- CreateTable
CREATE TABLE "RagFeedback" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" TEXT[],
    "rating" INTEGER NOT NULL,
    "chunkIds" TEXT[],
    "modelUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RagFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkScore" (
    "id" TEXT NOT NULL,
    "sourceDoc" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "chunkHash" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ChunkScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChunkScore_userId_sourceDoc_chunkHash_key" ON "ChunkScore"("userId", "sourceDoc", "chunkHash");

-- AddForeignKey
ALTER TABLE "RagFeedback" ADD CONSTRAINT "RagFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkScore" ADD CONSTRAINT "ChunkScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
