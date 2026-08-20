-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "actionItems" TEXT[],
ADD COLUMN     "keyPoints" TEXT[],
ADD COLUMN     "language" TEXT,
ADD COLUMN     "notesEditedAt" TIMESTAMP(3),
ADD COLUMN     "speakerCount" INTEGER,
ADD COLUMN     "structuredNotes" TEXT,
ADD COLUMN     "topics" TEXT[];
