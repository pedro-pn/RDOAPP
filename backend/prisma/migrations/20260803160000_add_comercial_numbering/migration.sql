-- Numeração de propostas do módulo Comercial.
--
-- A sequence é criada VAZIA e a linha de estado nasce com `seededAt = NULL`.
-- Isso é deliberado: o número emitido aqui vai no documento que chega ao
-- cliente, e o valor de partida depende do maior número já usado no CRM Nectar
-- e em `CommercialProposal` — dado que só existe no servidor de produção.
--
-- Enquanto `seededAt` for NULL, `GET /api/comercial/propostas/proximo-numero`
-- recusa com 503 em vez de emitir. Recusar é reversível; emitir um código
-- repetido, não.

-- CreateTable
CREATE TABLE "comercial"."ProposalNumberingState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "seededAt" TIMESTAMP(3),
    "seededByLabel" TEXT,
    "seedValue" INTEGER,

    CONSTRAINT "ProposalNumberingState_pkey" PRIMARY KEY ("id")
);

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "comercial"."proposal_number_seq" AS integer START WITH 1;

-- A linha única de estado. Sem ela a rota não tem o que consultar.
INSERT INTO "comercial"."ProposalNumberingState" ("id") VALUES ('singleton')
ON CONFLICT ("id") DO NOTHING;
