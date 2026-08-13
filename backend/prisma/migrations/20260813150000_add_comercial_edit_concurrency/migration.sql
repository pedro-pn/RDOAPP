-- Autoria da última edição e rótulo congelado para os avisos de concorrência
-- do Comercial (FR-069/FR-070).
--
-- `updatedAt` já existia, mas sozinho só responde QUANDO. Estes campos dizem
-- QUEM sem depender do nome atual da conta. Todos são opcionais para que os
-- registros anteriores à migration continuem válidos.

ALTER TABLE "comercial"."CostEstimate"
    ADD COLUMN "updatedByUserId" TEXT,
    ADD COLUMN "updatedByLabel" TEXT;

ALTER TABLE "comercial"."Proposal"
    ADD COLUMN "updatedByUserId" TEXT,
    ADD COLUMN "updatedByLabel" TEXT,
    ADD COLUMN "finalizedByLabel" TEXT;

-- Propostas já finalizadas ganham o nome atual como ponto de partida. Daqui em
-- diante o rótulo é gravado na própria finalização e não muda com a conta.
UPDATE "comercial"."Proposal" AS proposal
SET "finalizedByLabel" = COALESCE(NULLIF(TRIM(author."name"), ''), author."username")
FROM "public"."User" AS author
WHERE proposal."finalizedByUserId" = author."id"
  AND proposal."finalizedByLabel" IS NULL;

-- Contas normalmente são apenas desativadas. Se algum ambiente antigo tiver
-- apagado uma conta fisicamente, preserva-se o rótulo acima e limpa-se só a FK
-- órfã antes de criar a restrição.
UPDATE "comercial"."Proposal" AS proposal
SET "finalizedByUserId" = NULL
WHERE proposal."finalizedByUserId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."User" AS author
    WHERE author."id" = proposal."finalizedByUserId"
  );

ALTER TABLE "comercial"."CostEstimate"
    ADD CONSTRAINT "CostEstimate_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comercial"."Proposal"
    ADD CONSTRAINT "Proposal_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Proposal_finalizedByUserId_fkey"
    FOREIGN KEY ("finalizedByUserId") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
