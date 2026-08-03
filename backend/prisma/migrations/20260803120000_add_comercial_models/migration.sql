-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "comercial";

-- CreateEnum
CREATE TYPE "comercial"."CostEstimateMode" AS ENUM ('NOVA', 'REVISAO');

-- CreateEnum
CREATE TYPE "comercial"."CostEstimateStatus" AS ENUM ('RASCUNHO', 'SALVO');

-- CreateEnum
CREATE TYPE "comercial"."ProposalStatus" AS ENUM ('RASCUNHO', 'FINALIZANDO', 'FINALIZADA', 'FALHA_INTEGRACAO');

-- CreateEnum
CREATE TYPE "comercial"."ProposalDocumentKind" AS ENUM ('COMERCIAL', 'TECNICA');

-- CreateEnum
CREATE TYPE "comercial"."SalesAttributionKind" AS ENUM ('REPRESENTANTE', 'INDICACAO');

-- CreateEnum
CREATE TYPE "comercial"."ProposalAuditAction" AS ENUM ('FINALIZADA', 'INTEGRACAO_ENVIADA', 'INTEGRACAO_FALHOU', 'ARQUIVADA', 'DESARQUIVADA');

-- CreateTable
CREATE TABLE "comercial"."CostEstimate" (
    "id" TEXT NOT NULL,
    "proposalCode" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "mode" "comercial"."CostEstimateMode" NOT NULL,
    "status" "comercial"."CostEstimateStatus" NOT NULL DEFAULT 'RASCUNHO',
    "payload" JSONB NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "marginPercent" DECIMAL(6,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."CostEstimateVersion" (
    "id" TEXT NOT NULL,
    "costEstimateId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEstimateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."Proposal" (
    "id" TEXT NOT NULL,
    "proposalCode" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "costEstimateId" TEXT,
    "clientName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "department" TEXT,
    "sellerUserId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "estimatorName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "totalValue" DECIMAL(14,2) NOT NULL,
    "status" "comercial"."ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."ProposalDocument" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "kind" "comercial"."ProposalDocumentKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."ProposalAttachment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."ScopeAsset" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."SalesAttribution" (
    "id" TEXT NOT NULL,
    "costEstimateId" TEXT NOT NULL,
    "kind" "comercial"."SalesAttributionKind" NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial"."ProposalAuditLog" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "action" "comercial"."ProposalAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostEstimate_createdByUserId_archivedAt_createdAt_idx" ON "comercial"."CostEstimate"("createdByUserId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CostEstimate_proposalCode_revisionNumber_idx" ON "comercial"."CostEstimate"("proposalCode", "revisionNumber");

-- CreateIndex
CREATE INDEX "CostEstimateVersion_costEstimateId_createdAt_idx" ON "comercial"."CostEstimateVersion"("costEstimateId", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_createdByUserId_archivedAt_createdAt_idx" ON "comercial"."Proposal"("createdByUserId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_sellerUserId_createdAt_idx" ON "comercial"."Proposal"("sellerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "comercial"."Proposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalCode_revisionNumber_key" ON "comercial"."Proposal"("proposalCode", "revisionNumber");

-- CreateIndex
CREATE INDEX "ProposalDocument_proposalId_kind_idx" ON "comercial"."ProposalDocument"("proposalId", "kind");

-- CreateIndex
CREATE INDEX "ProposalAttachment_proposalId_idx" ON "comercial"."ProposalAttachment"("proposalId");

-- CreateIndex
CREATE INDEX "ScopeAsset_proposalId_idx" ON "comercial"."ScopeAsset"("proposalId");

-- CreateIndex
CREATE INDEX "SalesAttribution_costEstimateId_idx" ON "comercial"."SalesAttribution"("costEstimateId");

-- CreateIndex
CREATE INDEX "ProposalAuditLog_proposalId_createdAt_idx" ON "comercial"."ProposalAuditLog"("proposalId", "createdAt");

-- AddForeignKey
ALTER TABLE "comercial"."CostEstimate" ADD CONSTRAINT "CostEstimate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."CostEstimateVersion" ADD CONSTRAINT "CostEstimateVersion_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "comercial"."CostEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."Proposal" ADD CONSTRAINT "Proposal_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "comercial"."CostEstimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."Proposal" ADD CONSTRAINT "Proposal_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."Proposal" ADD CONSTRAINT "Proposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."ProposalDocument" ADD CONSTRAINT "ProposalDocument_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "comercial"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."ProposalAttachment" ADD CONSTRAINT "ProposalAttachment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "comercial"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."ScopeAsset" ADD CONSTRAINT "ScopeAsset_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "comercial"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."SalesAttribution" ADD CONSTRAINT "SalesAttribution_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "comercial"."CostEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial"."ProposalAuditLog" ADD CONSTRAINT "ProposalAuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "comercial"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

