-- Agrupamentos visuais de missões no módulo Acompanhamento.

CREATE TYPE "AcompanhamentoMissionGroupStatus" AS ENUM ('ACTIVE', 'DISSOLVED');

CREATE TABLE "AcompanhamentoMissionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AcompanhamentoMissionGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "dissolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dissolvedAt" TIMESTAMP(3),

    CONSTRAINT "AcompanhamentoMissionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcompanhamentoMissionGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activeProjectId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcompanhamentoMissionGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcompanhamentoMissionGroup_status_createdAt_idx" ON "AcompanhamentoMissionGroup"("status", "createdAt");
CREATE INDEX "AcompanhamentoMissionGroup_createdByUserId_idx" ON "AcompanhamentoMissionGroup"("createdByUserId");
CREATE INDEX "AcompanhamentoMissionGroup_dissolvedByUserId_idx" ON "AcompanhamentoMissionGroup"("dissolvedByUserId");

CREATE UNIQUE INDEX "AcompanhamentoMissionGroupMember_activeProjectId_key" ON "AcompanhamentoMissionGroupMember"("activeProjectId");
CREATE UNIQUE INDEX "AcompanhamentoMissionGroupMember_groupId_projectId_key" ON "AcompanhamentoMissionGroupMember"("groupId", "projectId");
CREATE INDEX "AcompanhamentoMissionGroupMember_groupId_order_idx" ON "AcompanhamentoMissionGroupMember"("groupId", "order");
CREATE INDEX "AcompanhamentoMissionGroupMember_projectId_idx" ON "AcompanhamentoMissionGroupMember"("projectId");

ALTER TABLE "AcompanhamentoMissionGroup" ADD CONSTRAINT "AcompanhamentoMissionGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcompanhamentoMissionGroup" ADD CONSTRAINT "AcompanhamentoMissionGroup_dissolvedByUserId_fkey" FOREIGN KEY ("dissolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcompanhamentoMissionGroupMember" ADD CONSTRAINT "AcompanhamentoMissionGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AcompanhamentoMissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcompanhamentoMissionGroupMember" ADD CONSTRAINT "AcompanhamentoMissionGroupMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
