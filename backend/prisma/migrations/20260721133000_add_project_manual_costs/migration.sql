CREATE TABLE "ProjectManualCost" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "costDate" TIMESTAMP(3),
  "note" TEXT,
  "createdByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectManualCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectManualCost_projectId_deletedAt_idx" ON "ProjectManualCost"("projectId", "deletedAt");
CREATE INDEX "ProjectManualCost_createdByUserId_idx" ON "ProjectManualCost"("createdByUserId");

ALTER TABLE "ProjectManualCost"
  ADD CONSTRAINT "ProjectManualCost_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectManualCost"
  ADD CONSTRAINT "ProjectManualCost_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
