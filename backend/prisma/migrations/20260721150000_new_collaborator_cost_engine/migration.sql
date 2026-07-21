-- Novo motor Motor_colaborador.xlsm:
-- - adiciona confinamento/offshore e moradia aos perfis-modelo;
-- - ajusta multa FGTS para 50% sobre FGTS mensal + provisoes;
-- - preenche beneficios ausentes com o default da planilha;
-- - preserva valores historicos ja preenchidos manualmente;
-- - nao altera salario base por cargo.

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{salarioMinimo}', '1621'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params" ? 'salarioMinimo');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{insalubridadePct}', '0.2'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params" ? 'insalubridadePct');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(
  cps."params",
  '{confinamentoPct}',
  CASE WHEN cp."key" = 'auxiliar' THEN '0.2'::jsonb ELSE '0.4'::jsonb END,
  true
)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params" ? 'confinamentoPct');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{multaPct}', '0.5'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND (
    NOT (cps."params" ? 'multaPct')
    OR cps."params"->>'multaPct' IN ('0.4', '0.40', '0.4000000000000000')
  );

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios}', '{}'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND (
    NOT (cps."params" ? 'beneficios')
    OR jsonb_typeof(cps."params"->'beneficios') <> 'object'
  );

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,seguroVida}', '50'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'seguroVida');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,valeAlimentacao}', '600'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'valeAlimentacao');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,planoSaude}', '500'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'planoSaude');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,odonto}', '18'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'odonto');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,cursos}', '300'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'cursos');

UPDATE "CostParameterSet" cps
SET "params" = jsonb_set(cps."params", '{beneficios,moradia}', '1000'::jsonb, true)
FROM "CostProfile" cp
WHERE cps."costProfileId" = cp."id"
  AND cp."jobRoleId" IS NULL
  AND NOT (cps."params"->'beneficios' ? 'moradia');
