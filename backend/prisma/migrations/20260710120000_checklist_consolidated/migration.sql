-- AlterTable
ALTER TABLE "EquipmentCategory" ADD COLUMN "checklistDisplayMode" TEXT NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "Romaneio" ADD COLUMN "checklistPdfUrl" TEXT;
ALTER TABLE "Romaneio" ADD COLUMN "checklistProjectLabel" TEXT;

-- AlterTable
ALTER TABLE "RomaneioChecklist" ADD COLUMN "categoryName" TEXT;
ALTER TABLE "RomaneioChecklist" ADD COLUMN "displayNameOrTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RomaneioChecklist" ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'AUTO';
