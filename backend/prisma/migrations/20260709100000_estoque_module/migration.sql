-- Modulo Estoque: filtros, produtos quimicos, lotes e movimentacoes

ALTER TYPE "AppModule" ADD VALUE IF NOT EXISTS 'ESTOQUE';
ALTER TYPE "ModuleRoleCode" ADD VALUE IF NOT EXISTS 'ESTOQUE_MANAGER';
ALTER TYPE "ModuleRoleCode" ADD VALUE IF NOT EXISTS 'ESTOQUE_VIEWER';

DO $$ BEGIN
  CREATE TYPE "StockItemType" AS ENUM ('FILTRO', 'PRODUTO_QUIMICO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA', 'SAIDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementReason" AS ENUM ('COMPRA', 'DEVOLUCAO_OBRA', 'INVENTARIO', 'USO_EM_PROJETO', 'PERDA', 'DESCARTE_VALIDADE', 'ESTORNO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StockItem" (
  "id" TEXT NOT NULL,
  "type" "StockItemType" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "description" TEXT,
  "unitLabel" TEXT NOT NULL,
  "minQuantity" DECIMAL(12,3),
  "location" TEXT,
  "filterModel" TEXT,
  "filterKind" TEXT,
  "filterMicron" TEXT,
  "unNumber" TEXT,
  "casNumber" TEXT,
  "fispqToken" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockBatch" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "expiryDate" TIMESTAMP(3),
  "nfNumber" TEXT,
  "supplier" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "reason" "StockMovementReason" NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "projectId" TEXT,
  "nfNumber" TEXT,
  "supplier" TEXT,
  "unitCost" DECIMAL(12,2),
  "requestedBy" TEXT,
  "notes" TEXT,
  "nfAttachmentToken" TEXT,
  "reversalOfId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockItem_code_key" ON "StockItem"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "StockBatch_itemId_lotNumber_key" ON "StockBatch"("itemId", "lotNumber");
CREATE INDEX IF NOT EXISTS "StockBatch_expiryDate_idx" ON "StockBatch"("expiryDate");

CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_reversalOfId_key" ON "StockMovement"("reversalOfId");
CREATE INDEX IF NOT EXISTS "StockMovement_itemId_date_idx" ON "StockMovement"("itemId", "date");
CREATE INDEX IF NOT EXISTS "StockMovement_batchId_idx" ON "StockMovement"("batchId");
CREATE INDEX IF NOT EXISTS "StockMovement_projectId_idx" ON "StockMovement"("projectId");
CREATE INDEX IF NOT EXISTS "StockMovement_type_idx" ON "StockMovement"("type");

DO $$ BEGIN
  ALTER TABLE "StockBatch"
    ADD CONSTRAINT "StockBatch_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_reversalOfId_fkey"
    FOREIGN KEY ("reversalOfId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
