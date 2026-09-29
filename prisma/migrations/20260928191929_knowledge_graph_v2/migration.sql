-- CreateEnum
CREATE TYPE "KGNodeType" AS ENUM ('CONCEPT', 'ENTITY', 'PERSON', 'ORGANIZATION', 'TECHNOLOGY', 'EVENT', 'LOCATION', 'THEORY', 'PROCESS', 'ATTRIBUTE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "KGEdgeType" AS ENUM ('IS_A', 'HAS_A', 'USES', 'CAUSES', 'PART_OF', 'RELATED_TO', 'DEFINED_BY', 'OPPOSES', 'PRECEDES', 'IMPLEMENTS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "KGNodeStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'MERGED', 'DELETED');

-- CreateEnum
CREATE TYPE "KGSourceType" AS ENUM ('DOCUMENT', 'URL', 'VIDEO_TRANSCRIPT', 'MANUAL', 'RAG_CHUNK');

-- CreateTable
CREATE TABLE "KGSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "KGSourceType" NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "pageCount" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KGSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGChunk" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "startChar" INTEGER,
    "endChar" INTEGER,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "KGChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGNode" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "nodeType" "KGNodeType" NOT NULL DEFAULT 'CONCEPT',
    "status" "KGNodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "embedding" JSONB,
    "chromaId" TEXT,
    "extractedBy" TEXT NOT NULL DEFAULT 'system',
    "verifiedBy" TEXT,
    "extractionMethod" TEXT,
    "theoryCache" JSONB,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "primarySourceId" TEXT,

    CONSTRAINT "KGNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGEdge" (
    "id" TEXT NOT NULL,
    "edgeType" "KGEdgeType" NOT NULL DEFAULT 'RELATED_TO',
    "label" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isDirected" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "extractedBy" TEXT NOT NULL DEFAULT 'system',
    "verifiedBy" TEXT,
    "extractionMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "primarySourceId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KGEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGNodeChunk" (
    "id" TEXT NOT NULL,
    "spanStart" INTEGER,
    "spanEnd" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mentionText" TEXT,
    "nodeId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,

    CONSTRAINT "KGNodeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGEdgeChunk" (
    "id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "evidenceText" TEXT,
    "edgeId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,

    CONSTRAINT "KGEdgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGNodeVersion" (
    "id" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "nodeType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "aliases" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "KGNodeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KGGraph" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Knowledge Graph',
    "description" TEXT,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "lastBuiltAt" TIMESTAMP(3),
    "layoutSaved" JSONB,
    "filterPresets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KGGraph_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KGChunk_sourceId_chunkIndex_idx" ON "KGChunk"("sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "KGNode_workspaceId_status_idx" ON "KGNode"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KGNode_workspaceId_nodeType_idx" ON "KGNode"("workspaceId", "nodeType");

-- CreateIndex
CREATE INDEX "KGEdge_workspaceId_idx" ON "KGEdge"("workspaceId");

-- CreateIndex
CREATE INDEX "KGEdge_sourceId_idx" ON "KGEdge"("sourceId");

-- CreateIndex
CREATE INDEX "KGEdge_targetId_idx" ON "KGEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "KGEdge_sourceId_targetId_edgeType_key" ON "KGEdge"("sourceId", "targetId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "KGNodeChunk_nodeId_chunkId_key" ON "KGNodeChunk"("nodeId", "chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "KGEdgeChunk_edgeId_chunkId_key" ON "KGEdgeChunk"("edgeId", "chunkId");

-- CreateIndex
CREATE INDEX "KGNodeVersion_nodeId_versionNum_idx" ON "KGNodeVersion"("nodeId", "versionNum");

-- CreateIndex
CREATE UNIQUE INDEX "KGGraph_workspaceId_key" ON "KGGraph"("workspaceId");

-- AddForeignKey
ALTER TABLE "KGSource" ADD CONSTRAINT "KGSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGChunk" ADD CONSTRAINT "KGChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KGSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGNode" ADD CONSTRAINT "KGNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGNode" ADD CONSTRAINT "KGNode_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "KGSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdge" ADD CONSTRAINT "KGEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KGNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdge" ADD CONSTRAINT "KGEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "KGNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdge" ADD CONSTRAINT "KGEdge_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "KGSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdge" ADD CONSTRAINT "KGEdge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGNodeChunk" ADD CONSTRAINT "KGNodeChunk_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "KGNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGNodeChunk" ADD CONSTRAINT "KGNodeChunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KGChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdgeChunk" ADD CONSTRAINT "KGEdgeChunk_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "KGEdge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGEdgeChunk" ADD CONSTRAINT "KGEdgeChunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KGChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGNodeVersion" ADD CONSTRAINT "KGNodeVersion_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "KGNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KGGraph" ADD CONSTRAINT "KGGraph_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
