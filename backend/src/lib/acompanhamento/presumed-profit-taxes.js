const DEFAULT_SERVICE_TAX_CODE = '7.05';
const METHOD = 'COMMERCIAL_TAX_SPREADSHEET_2026';

const ISS_RATE = 0.03;
const PIS_RATE = 0.0065;
const COFINS_RATE = 0.03;
const IRPJ_RATE = 0.15;
const CSLL_RATE = 0.09;
const ADDITIONAL_IRPJ_RATE = 0.10;
const ADDITIONAL_IRPJ_THRESHOLD = 0;

const SERVICE_TAX_RULES = {
  '14.01': {
    serviceTaxCode: '14.01',
    spreadsheetBlock: '14.01 + 10% Tributacao 2026',
    irpjPresumptionRate: 0.35,
    csllPresumptionRate: 0.35
  },
  '7.05': {
    serviceTaxCode: '7.05',
    spreadsheetBlock: '7.05 + 10% Tributacao 2026',
    irpjPresumptionRate: 0.088,
    csllPresumptionRate: 0.132
  },
  '7.02': {
    serviceTaxCode: '7.02',
    equivalentServiceTaxCode: '7.05',
    spreadsheetBlock: '7.05 + 10% Tributacao 2026',
    irpjPresumptionRate: 0.088,
    csllPresumptionRate: 0.132
  }
};

const TAX_CODE_KEYS = [
  'serviceTaxCode',
  'taxCode',
  'saleTaxCode',
  'codigoVenda',
  'codigoServico',
  'codigoServicoFiscal',
  'codigoTributacao',
  'codigoLc116',
  'lc116'
];

export const PRESUMED_PROFIT_TAX_ASSUMPTIONS = {
  method: METHOD,
  defaultServiceTaxCode: DEFAULT_SERVICE_TAX_CODE,
  supportedServiceTaxCodes: Object.keys(SERVICE_TAX_RULES),
  projectCostBasis: 'IRPJ_CSLL_OUTSIDE_INVOICE',
  issRatePct: 3,
  pisRatePct: 0.65,
  cofinsRatePct: 3,
  irpjRatePct: 15,
  csllRatePct: 9,
  additionalIrpjRatePct: 10,
  additionalIrpjThreshold: ADDITIONAL_IRPJ_THRESHOLD,
  source: 'IMPOSTO - PARA SERVICOS.xlsx'
};

function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPct(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeServiceTaxCode(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().replace(',', '.');
  if (SERVICE_TAX_RULES[raw]) return raw;
  const match = raw.match(/\b(14\.01|7\.05|7\.02)\b/);
  return match ? match[1] : null;
}

function findServiceTaxCode(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;

  for (const key of TAX_CODE_KEYS) {
    const direct = normalizeServiceTaxCode(source[key]);
    if (direct) return direct;
  }

  for (const [key, value] of Object.entries(source)) {
    if (!/(codigo|code|tribut|serv|fiscal|lc116|venda)/i.test(key)) continue;
    const inferred = normalizeServiceTaxCode(value);
    if (inferred) return inferred;
  }

  return null;
}

export function resolveServiceTaxCode(...sources) {
  for (const source of sources) {
    const code = normalizeServiceTaxCode(source) ?? findServiceTaxCode(source);
    if (code) return code;
  }
  return DEFAULT_SERVICE_TAX_CODE;
}

export function buildPresumedProfitTaxEstimate(salePrice, options = {}) {
  const expectedSale = toNum(salePrice);
  const invoicedAmount = toNum(options.invoicedAmount);
  const basis = invoicedAmount !== null && invoicedAmount > 0 ? invoicedAmount : expectedSale;
  if (basis === null || basis <= 0) return null;

  const serviceTaxCode = resolveServiceTaxCode(options.serviceTaxCode, options.components);
  const rule = SERVICE_TAX_RULES[serviceTaxCode] ?? SERVICE_TAX_RULES[DEFAULT_SERVICE_TAX_CODE];
  const basisSource = invoicedAmount !== null && invoicedAmount > 0 ? 'OMIE_INVOICED' : 'EXPECTED_SALE';
  const omieIss = toNum(options.invoiceIss);

  const iss = basis * ISS_RATE;
  const pis = basis * PIS_RATE;
  const cofins = basis * COFINS_RATE;
  const invoiceTaxTotal = iss + pis + cofins;
  const irpjPresumedBasis = basis * rule.irpjPresumptionRate;
  const csllPresumedBasis = basis * rule.csllPresumptionRate;
  const irpjBasic = irpjPresumedBasis * IRPJ_RATE;
  const csll = csllPresumedBasis * CSLL_RATE;
  const additionalIrpjEstimated = Math.max(irpjPresumedBasis - ADDITIONAL_IRPJ_THRESHOLD, 0) * ADDITIONAL_IRPJ_RATE;
  const irpjTotal = irpjBasic + additionalIrpjEstimated;
  const irpjCsllTotal = irpjTotal + csll;
  const minimumOutOfInvoiceTaxTotal = irpjBasic + csll;
  const minimumTotal = invoiceTaxTotal + minimumOutOfInvoiceTaxTotal;
  const probableTotal = minimumTotal + additionalIrpjEstimated;
  const effectiveTaxPct = (probableTotal / basis) * 100;
  const minimumEffectivePct = (minimumTotal / basis) * 100;
  const invoiceTaxEffectivePct = (invoiceTaxTotal / basis) * 100;
  const irpjCsllEffectivePct = (irpjCsllTotal / basis) * 100;

  return {
    ...PRESUMED_PROFIT_TAX_ASSUMPTIONS,
    serviceTaxCode: rule.serviceTaxCode,
    equivalentServiceTaxCode: rule.equivalentServiceTaxCode ?? null,
    spreadsheetBlock: rule.spreadsheetBlock,
    basisSource,
    basisAmount: roundMoney(basis),
    expectedSalePrice: expectedSale !== null ? roundMoney(expectedSale) : null,
    invoicedAmount: invoicedAmount !== null && invoicedAmount > 0 ? roundMoney(invoicedAmount) : null,
    salePrice: roundMoney(basis),
    iss: roundMoney(iss),
    omieIss: omieIss !== null ? roundMoney(omieIss) : null,
    issDelta: omieIss !== null ? roundMoney(omieIss - iss) : null,
    pis: roundMoney(pis),
    cofins: roundMoney(cofins),
    invoiceTaxTotal: roundMoney(invoiceTaxTotal),
    irpjPresumedBasis: roundMoney(irpjPresumedBasis),
    csllPresumedBasis: roundMoney(csllPresumedBasis),
    presumedBasis: roundMoney(irpjPresumedBasis),
    irpjPresumptionPct: roundPct(rule.irpjPresumptionRate * 100),
    csllPresumptionPct: roundPct(rule.csllPresumptionRate * 100),
    presumptionPct: roundPct(rule.irpjPresumptionRate * 100),
    irpjBasic: roundMoney(irpjBasic),
    csll: roundMoney(csll),
    additionalIrpjEstimated: roundMoney(additionalIrpjEstimated),
    irpjTotal: roundMoney(irpjTotal),
    irpjCsllTotal: roundMoney(irpjCsllTotal),
    outOfInvoiceTaxTotal: roundMoney(irpjCsllTotal),
    estimatedProjectTaxCost: roundMoney(irpjCsllTotal),
    totalTax: roundMoney(probableTotal),
    netAfterTaxes: roundMoney(basis - probableTotal),
    netAfterOutOfInvoiceTaxes: roundMoney(basis - irpjCsllTotal),
    minimumOutOfInvoiceTaxTotal: roundMoney(minimumOutOfInvoiceTaxTotal),
    minimumTotal: roundMoney(minimumTotal),
    probableTotal: roundMoney(probableTotal),
    minimumEffectivePct: roundPct(minimumEffectivePct),
    probableEffectivePct: roundPct(effectiveTaxPct),
    effectiveTaxPct: roundPct(effectiveTaxPct),
    invoiceTaxEffectivePct: roundPct(invoiceTaxEffectivePct),
    irpjCsllEffectivePct: roundPct(irpjCsllEffectivePct)
  };
}
