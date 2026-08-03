/**
 * Formatadores do módulo Comercial — porte de `app/custos/page.tsx:3362-3382`.
 *
 * Copiados ao pé da letra porque o formato faz parte da paridade: mudar de
 * "R$ 105.920,80" para "R$ 105920.8" é divergência visível em toda a tela, e
 * o aceite lado a lado compara texto por texto.
 */

export function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numberValue(value));
}

export function percent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(numberValue(value));
}

export function number(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
    numberValue(value)
  );
}

export function people(value: number, singular = 'pessoa', plural = 'pessoas'): string {
  const amount = numberValue(value);
  return `${number(amount)} ${amount === 1 ? singular : plural}`;
}
