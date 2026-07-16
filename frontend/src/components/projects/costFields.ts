// Campos compartilhados do motor de custo (editor de perfil operador/auxiliar e por cargo).

export const PARAM_FIELDS: Array<[string, string]> = [
  ['salarioBase', 'Salário base (R$)'],
  ['insalubridade', 'Insalubridade (R$)'],
  ['cargaHoraria', 'Carga horária mensal'],
  ['diasUteis', 'Dias úteis'],
  ['periculosidadePct', 'Periculosidade (fração, ex.: 0,3)'],
  ['produtividadePct', 'Produtividade/Gratificação (fração)'],
  ['transferenciaPct', 'Transferência/Viagem (fração)'],
  ['he70Pct', 'HE 70% (fração)'],
  ['he100Pct', 'HE 100% (fração)'],
  ['fgtsPct', 'FGTS (fração)']
];

export const BENEFIT_FIELDS: Array<[string, string]> = [
  ['planoSaude', 'Plano de saúde'],
  ['valeAlimentacao', 'Vale alimentação'],
  ['odonto', 'Odontológico'],
  ['seguroVida', 'Seguro de vida'],
  ['cursos', 'Cursos']
];

export const INPUT_FIELDS: Array<[string, string]> = [
  ['diasCliente', 'Dias em cliente (periculosidade)'],
  ['diasFora', 'Dias dormindo fora (viagem)'],
  ['diasCasa', 'Dias dormindo em casa (produtividade)'],
  ['he70Horas', 'Horas extras 70%'],
  ['he100Horas', 'Horas extras 100%']
];

export function brl(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Numeração dos modelos base (planilhas): Modelo 1 = Operador, Modelo 2 = Auxiliar.
export const MODEL_ORDER: Record<string, number> = { operador: 1, auxiliar: 2 };
export function modelNumber(key: string, fallback: number) {
  return MODEL_ORDER[key] ?? fallback;
}
