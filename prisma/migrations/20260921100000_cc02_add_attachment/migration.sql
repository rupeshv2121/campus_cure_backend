-- CC-02: file storage.
--
-- Additive in full: a new table and two new enums, with nothing else
-- referencing them. Applying this is therefore safe even though the feature
-- ships switched off (STORAGE_ENABLED), and leaving it applied after a code
-- rollback is harmless.
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'ATTACHED');

CREATE TYPE "AttachmentEntity" AS ENUM ('DOUBT', 'ANSWER', 'COMPLAINT', 'COMPLAINT_RESOLUTION');

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    -- Server-generated object key. Never client-supplied: a client-chosen
    -- path is a traversal and overwrite primitive.
    "storagePath" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    -- Null until confirmed. Deliberately NOT a foreign key: four possible
    -- parents cannot be one relation, and four nullable columns would make
    -- every read path branch. The nightly sweep covers the missing cascade.
    "entityType" "AttachmentEntity",
    "entityId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attachment_storagePath_key" ON "Attachment"("storagePath");
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
-- Drives the nightly sweep of unconfirmed uploads.
CREATE INDEX "Attachment_status_createdAt_idx" ON "Attachment"("status", "createdAt");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
