-- Integracao Romaneio x Estoque.

ALTER TYPE "RomaneioCatalogSource" ADD VALUE IF NOT EXISTS 'STOCK';

ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "romaneioId" TEXT;

CREATE INDEX IF NOT EXISTS "StockMovement_romaneioId_idx" ON "StockMovement"("romaneioId");

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_romaneioId_fkey"
    FOREIGN KEY ("romaneioId") REFERENCES "Romaneio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
