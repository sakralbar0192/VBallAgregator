-- CreateTable
CREATE TABLE "messaging_outbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateId" TEXT,
    "correlationId" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "messaging_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messaging_outbox_publishedAt_createdAt_idx" ON "messaging_outbox"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "messaging_outbox_eventType_idx" ON "messaging_outbox"("eventType");
