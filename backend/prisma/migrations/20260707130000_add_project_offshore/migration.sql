-- Projeto offshore: acréscimo de transferência no custo de mão de obra (HH).
ALTER TABLE "Project" ADD COLUMN "offshore" BOOLEAN NOT NULL DEFAULT false;
