-- Mudanca retroativa da regra de custo de mao de obra:
-- INSS patronal e multa rescisoria deixam de compor todos os calculos, inclusive historicos.
UPDATE "CostParameterSet"
SET "params" = "params" - 'inssPatronalPct' - 'multaPct'
WHERE "params" ? 'inssPatronalPct'
   OR "params" ? 'multaPct';
