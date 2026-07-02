/*
 * Filtro de custos de salário/mão de obra do Omie (módulo Acompanhamento).
 *
 * Regra do cliente: salários vindos do Omie NÃO devem ser considerados em nenhum lugar do
 * acompanhamento (serão calculados no app via integração do ponto). Identificamos por palavra-chave
 * na descrição da categoria.
 */

import prisma from './prisma.js';

// Palavras-chave (sem acento, minúsculas) que marcam uma categoria como salário/mão de obra.
const SALARY_KEYWORDS = [
  'salario', 'folha', 'pro-labore', 'prolabore', 'pro labore', 'inss', 'fgts',
  'ferias', 'rescisao', 'adiantamento', 'decimo terceiro', '13o salario', 'vale transporte',
  'vale alimentacao', 'vale refeicao'
];

function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Uma categoria (pela descrição) é de salário/mão de obra?
export function isSalaryCategory(descricao) {
  const key = normalize(descricao);
  return SALARY_KEYWORDS.some(word => key.includes(word));
}

// Códigos de categoria de salário presentes nas compras (para excluir via where do Prisma).
// Cacheado por alguns minutos — categorias mudam raramente e isso é chamado em vários endpoints.
let cache = { at: 0, codes: [] };
const CACHE_MS = 5 * 60 * 1000;

export async function getSalaryCategoryCodes() {
  if (Date.now() - cache.at < CACHE_MS) return cache.codes;
  const groups = await prisma.omiePurchase.groupBy({ by: ['categoriaCodigo', 'categoriaDescricao'] });
  const codes = groups
    .filter(g => g.categoriaCodigo && isSalaryCategory(g.categoriaDescricao || g.categoriaCodigo))
    .map(g => g.categoriaCodigo);
  cache = { at: Date.now(), codes };
  return codes;
}
