-- AlterTable
ALTER TABLE "EquipmentCategory" ADD COLUMN "checklistEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EquipmentCategory" ADD COLUMN "checklistItems" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "CompanyEquipment" ADD COLUMN "checklistItems" JSONB;

-- AlterTable
ALTER TABLE "Romaneio" ADD COLUMN "checklistResponsibleName" TEXT;
ALTER TABLE "Romaneio" ADD COLUMN "checklistSignatureImage" TEXT;

-- CreateTable
CREATE TABLE "RomaneioChecklist" (
    "id" TEXT NOT NULL,
    "romaneioId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "equipmentId" TEXT,
    "equipmentCode" TEXT NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "projectLabel" TEXT,
    "pdfUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomaneioChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RomaneioChecklist_romaneioId_idx" ON "RomaneioChecklist"("romaneioId");

-- CreateIndex
CREATE INDEX "RomaneioChecklist_romaneioId_sortOrder_idx" ON "RomaneioChecklist"("romaneioId", "sortOrder");

-- CreateIndex
CREATE INDEX "RomaneioChecklist_catalogItemId_idx" ON "RomaneioChecklist"("catalogItemId");

-- AddForeignKey
ALTER TABLE "RomaneioChecklist" ADD CONSTRAINT "RomaneioChecklist_romaneioId_fkey" FOREIGN KEY ("romaneioId") REFERENCES "Romaneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomaneioChecklist" ADD CONSTRAINT "RomaneioChecklist_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "RomaneioCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
