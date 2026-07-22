CREATE TABLE "ProjectManualProgressHistory" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "progressPct" DECIMAL(5,2) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectManualProgressHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectManualProgressHistory_projectId_recordedAt_idx" ON "ProjectManualProgressHistory"("projectId", "recordedAt");

ALTER TABLE "ProjectManualProgressHistory"
  ADD CONSTRAINT "ProjectManualProgressHistory_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProjectManualProgressHistory" ("id", "projectId", "progressPct", "recordedAt", "createdAt")
SELECT gen_random_uuid()::text, "id", "manualProgressPct", COALESCE("updatedAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "Project"
WHERE "manualProgressPct" IS NOT NULL;
