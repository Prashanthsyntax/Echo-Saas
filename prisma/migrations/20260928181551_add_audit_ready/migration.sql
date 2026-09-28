-- CreateEnum
CREATE TYPE "ControlStatus" AS ENUM ('NOT_TESTED', 'PASSING', 'FAILING', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "AuditFindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'IN_REMEDIATION', 'REMEDIATED', 'ACCEPTED_RISK', 'RECURRING');

-- CreateEnum
CREATE TYPE "ComplianceFramework" AS ENUM ('SOC2', 'ISO27001', 'HIPAA', 'PCI_DSS', 'GDPR');

-- CreateTable
CREATE TABLE "ComplianceControl" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "framework" "ComplianceFramework" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cweIds" JSONB NOT NULL,
    "status" "ControlStatus" NOT NULL DEFAULT 'NOT_TESTED',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestedBy" TEXT,
    "evidenceNotes" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ComplianceControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AuditFindingSeverity" NOT NULL,
    "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
    "rootCause" TEXT,
    "affectedSystem" TEXT,
    "auditorNotes" TEXT,
    "evidence" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediatedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "cweId" TEXT,
    "sentraFindingId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "controlId" TEXT,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRemediationEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findingId" TEXT,
    "controlId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AuditRemediationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AuditConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditConversationMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "memoriesUsed" JSONB,
    "controlsReferenced" JSONB,
    "findingsReferenced" JSONB,
    "interactionNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "AuditConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditMemoryLog" (
    "id" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "chromaId" TEXT,
    "controlId" TEXT,
    "findingId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AuditMemoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceControl_workspaceId_controlId_framework_key" ON "ComplianceControl"("workspaceId", "controlId", "framework");

-- AddForeignKey
ALTER TABLE "ComplianceControl" ADD CONSTRAINT "ComplianceControl_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "ComplianceControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRemediationEvent" ADD CONSTRAINT "AuditRemediationEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRemediationEvent" ADD CONSTRAINT "AuditRemediationEvent_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "ComplianceControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRemediationEvent" ADD CONSTRAINT "AuditRemediationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditConversation" ADD CONSTRAINT "AuditConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditConversationMessage" ADD CONSTRAINT "AuditConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AuditConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMemoryLog" ADD CONSTRAINT "AuditMemoryLog_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMemoryLog" ADD CONSTRAINT "AuditMemoryLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
