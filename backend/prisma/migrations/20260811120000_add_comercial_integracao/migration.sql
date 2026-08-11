-- Campos de integração externa da proposta (T076).
--
-- Guardados POR DESTINO, e não num campo só, porque Nectar e SharePoint falham
-- independentemente: o card pode entrar no CRM e a pasta não ser criada, e a
-- resposta ao usuário precisa dizer qual dos dois falhou.
--
-- Aditiva e sem reescrita: toda proposta existente nasce PENDENTE, que é a
-- verdade — nenhuma delas foi integrada, porque a integração não existia.

-- CreateEnum
CREATE TYPE "comercial"."ProposalIntegrationStatus" AS ENUM ('PENDENTE', 'SUCESSO', 'ERRO');

-- AlterTable
ALTER TABLE "comercial"."Proposal"
    ADD COLUMN "nectarStatus" "comercial"."ProposalIntegrationStatus" NOT NULL DEFAULT 'PENDENTE',
    ADD COLUMN "nectarOpportunityId" TEXT,
    ADD COLUMN "nectarPipelineId" TEXT,
    ADD COLUMN "nectarPipelineName" TEXT,
    ADD COLUMN "sharepointStatus" "comercial"."ProposalIntegrationStatus" NOT NULL DEFAULT 'PENDENTE',
    ADD COLUMN "sharepointFolder" TEXT,
    ADD COLUMN "integrationError" TEXT;

-- CreateIndex
-- A revisão procura o card já salvo pelo código da proposta (FR-066).
CREATE INDEX "Proposal_proposalCode_nectarOpportunityId_idx" ON "comercial"."Proposal"("proposalCode", "nectarOpportunityId");
