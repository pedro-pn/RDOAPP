-- Previsão manual de horas normais vendidas por projeto/cargo.

CREATE TABLE "ProjectPlannedNormalHours" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobRoleId" TEXT,
    "roleName" TEXT,
    "collaboratorCount" INTEGER NOT NULL DEFAULT 1,
    "hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlannedNormalHours_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectPlannedNormalHours_projectId_idx" ON "ProjectPlannedNormalHours"("projectId");
CREATE INDEX "ProjectPlannedNormalHours_jobRoleId_idx" ON "ProjectPlannedNormalHours"("jobRoleId");

ALTER TABLE "ProjectPlannedNormalHours" ADD CONSTRAINT "ProjectPlannedNormalHours_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPlannedNormalHours" ADD CONSTRAINT "ProjectPlannedNormalHours_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
