-- Recoloca a multa rescisoria de 40% como regra geral retroativa dos modelos base.
-- Perfis por cargo seguem herdando esse parametro do modelo selecionado.
UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{multaPct}', '0.4'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND (
    NOT (cps."params" ? 'multaPct')
    OR cps."params"->'multaPct' = 'null'::jsonb
  );
