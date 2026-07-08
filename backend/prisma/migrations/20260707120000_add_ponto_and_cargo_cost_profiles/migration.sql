-- Custo de mão de obra (HH): perfil de custo por cargo + ponto (jornada) importado do Pontomais.

-- 1) CostProfile pode ser vinculado a um cargo (JobRole).
ALTER TABLE "CostProfile" ADD COLUMN "jobRoleId" TEXT;
CREATE UNIQUE INDEX "CostProfile_jobRoleId_key" ON "CostProfile"("jobRoleId");
ALTER TABLE "CostProfile" ADD CONSTRAINT "CostProfile_jobRoleId_fkey"
  FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Auditoria de cada importação de ponto.
CREATE TABLE "PontoImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "rowsRead" INTEGER NOT NULL DEFAULT 0,
    "collaboratorsTotal" INTEGER NOT NULL DEFAULT 0,
    "collaboratorsMatched" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "importedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PontoImport_createdAt_idx" ON "PontoImport"("createdAt");
CREATE INDEX "PontoImport_contentHash_idx" ON "PontoImport"("contentHash");

-- 3) Resumo por colaborador em cada import.
CREATE TABLE "PontoPeriodSummary" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "he70Minutes" INTEGER NOT NULL DEFAULT 0,
    "he100Minutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoPeriodSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PontoPeriodSummary_importId_normalizedName_key" ON "PontoPeriodSummary"("importId", "normalizedName");
CREATE INDEX "PontoPeriodSummary_collaboratorId_idx" ON "PontoPeriodSummary"("collaboratorId");
CREATE INDEX "PontoPeriodSummary_importId_idx" ON "PontoPeriodSummary"("importId");
ALTER TABLE "PontoPeriodSummary" ADD CONSTRAINT "PontoPeriodSummary_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "PontoImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PontoPeriodSummary" ADD CONSTRAINT "PontoPeriodSummary_collaboratorId_fkey"
  FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Alias nome-do-ponto → colaborador (lembra vínculos manuais entre imports).
CREATE TABLE "PontoNameAlias" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PontoNameAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PontoNameAlias_normalizedName_key" ON "PontoNameAlias"("normalizedName");
CREATE INDEX "PontoNameAlias_collaboratorId_idx" ON "PontoNameAlias"("collaboratorId");
ALTER TABLE "PontoNameAlias" ADD CONSTRAINT "PontoNameAlias_collaboratorId_fkey"
  FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
