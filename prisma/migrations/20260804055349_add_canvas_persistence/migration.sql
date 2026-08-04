-- CreateTable
CREATE TABLE "CanvasState" (
    "id" TEXT NOT NULL,
    "canvasData" JSONB NOT NULL,
    "viewportX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zoomLevel" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "objectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CanvasState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanvasState_userId_workspaceId_key" ON "CanvasState"("userId", "workspaceId");

-- AddForeignKey
ALTER TABLE "CanvasState" ADD CONSTRAINT "CanvasState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasState" ADD CONSTRAINT "CanvasState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
