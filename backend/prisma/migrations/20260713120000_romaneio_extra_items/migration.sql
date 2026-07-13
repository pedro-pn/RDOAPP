ALTER TABLE "RomaneioItem"
  ADD COLUMN "isExtra" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StockMovement"
  ADD COLUMN "excludeFromProjectCost" BOOLEAN NOT NULL DEFAULT false;
