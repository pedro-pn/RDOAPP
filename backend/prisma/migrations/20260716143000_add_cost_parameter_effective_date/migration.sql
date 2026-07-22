ALTER TABLE "CostParameterSet" ADD COLUMN "effectiveDate" DATE;

UPDATE "CostParameterSet"
SET "effectiveDate" = DATE '1970-01-01'
WHERE "effectiveDate" IS NULL;

ALTER TABLE "CostParameterSet" ALTER COLUMN "effectiveDate" SET NOT NULL;

CREATE INDEX "CostParameterSet_costProfileId_effectiveDate_idx"
ON "CostParameterSet"("costProfileId", "effectiveDate");
