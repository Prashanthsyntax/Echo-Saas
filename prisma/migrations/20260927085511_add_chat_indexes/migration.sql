-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_conversationId_idx" ON "ConversationParticipant"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_parentId_createdAt_idx" ON "Message"("conversationId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_isDeleted_createdAt_idx" ON "Message"("conversationId", "isDeleted", "createdAt");
