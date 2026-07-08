-- Detalhe por mês do ponto (para dividir folha por mês e aplicar o teto de HE70 por mês).
ALTER TABLE "PontoPeriodSummary" ADD COLUMN "monthly" JSONB;
