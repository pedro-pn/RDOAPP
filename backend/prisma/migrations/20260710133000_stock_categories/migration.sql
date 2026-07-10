CREATE TABLE "StockCategory" (
  "id" TEXT NOT NULL,
  "type" "StockItemType" NOT NULL,
  "name" TEXT NOT NULL,
  "checklistEnabled" BOOLEAN NOT NULL DEFAULT false,
  "checklistItems" JSONB NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockCategory_type_name_key" ON "StockCategory"("type", "name");
CREATE INDEX "StockCategory_type_isActive_name_idx" ON "StockCategory"("type", "isActive", "name");

ALTER TABLE "StockItem" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "StockItem" ALTER COLUMN "checklistItems" DROP NOT NULL;
ALTER TABLE "StockItem" ALTER COLUMN "checklistItems" DROP DEFAULT;
UPDATE "StockItem" SET "checklistItems" = NULL WHERE "checklistItems" IS NULL OR "checklistItems" = '[]'::jsonb;

INSERT INTO "StockCategory" ("id", "type", "name", "createdAt", "updatedAt")
VALUES
  ('stock-category-filtros', 'FILTRO', 'Filtros', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stock-category-produtos-quimicos', 'PRODUTO_QUIMICO', 'Produtos químicos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("type", "name") DO NOTHING;

UPDATE "StockItem"
SET "categoryId" = 'stock-category-filtros'
WHERE "type" = 'FILTRO' AND "categoryId" IS NULL;

UPDATE "StockItem"
SET "categoryId" = 'stock-category-produtos-quimicos'
WHERE "type" = 'PRODUTO_QUIMICO' AND "categoryId" IS NULL;

CREATE INDEX "StockItem_categoryId_idx" ON "StockItem"("categoryId");

ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "StockCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
