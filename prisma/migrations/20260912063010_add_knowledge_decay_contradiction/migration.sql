-- CreateEnum
CREATE TYPE "ContradictionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ContradictionStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "KnowledgeDecayLog" (
    "id" TEXT NOT NULL,
    "sourceDoc" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "avgDecayScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "halfLifeDays" INTEGER NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeDecayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeContradiction" (
    "id" TEXT NOT NULL,
    "sourceDocA" TEXT NOT NULL,
    "sourceDocB" TEXT NOT NULL,
    "chunkTextA" TEXT NOT NULL,
    "chunkTextB" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "llmVerdict" TEXT NOT NULL,
    "severity" "ContradictionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ContradictionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeContradiction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDecayLog_workspaceId_sourceDoc_key" ON "KnowledgeDecayLog"("workspaceId", "sourceDoc");

-- AddForeignKey
ALTER TABLE "KnowledgeDecayLog" ADD CONSTRAINT "KnowledgeDecayLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeContradiction" ADD CONSTRAINT "KnowledgeContradiction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
