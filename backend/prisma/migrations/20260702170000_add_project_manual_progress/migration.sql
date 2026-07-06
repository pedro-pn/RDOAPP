-- Avanço informado manualmente (fallback quando o projeto não tem escopo previsto cadastrado).
ALTER TABLE "Project" ADD COLUMN "manualProgressPct" DECIMAL(5,2);
