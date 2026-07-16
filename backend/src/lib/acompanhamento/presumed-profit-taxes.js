const DEFAULT_SERVICE_TAX_CODE = '7.05';
const METHOD = 'COMMERCIAL_TAX_SPREADSHEET_2026';

const DEFAULT_ISS_RATE = 0.03;
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
  'codigoLC116',
  'CodigoLC116',
  'CodigoServico',
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
  if (match) return match[1];
  const digits = raw.replace(/\D/g, '');
  if (/^1401/.test(digits)) return '14.01';
  if (/^0?705/.test(digits)) return '7.05';
  if (/^0?702/.test(digits)) return '7.02';
  return null;
}

function normalizeOmieServiceTaxCode(value) {
  const supported = normalizeServiceTaxCode(value);
  if (supported) return supported;
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().replace(',', '.');
  const dotted = raw.match(/\b(\d{1,2})\.(\d{2})\b/);
  if (dotted) return `${Number(dotted[1])}.${dotted[2]}`;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 4) return `${Number(digits.slice(0, 2))}.${digits.slice(2)}`;
  return raw || null;
}

function ignoresIss(omieServiceTaxCode) {
  return normalizeOmieServiceTaxCode(omieServiceTaxCode) === '99.01';
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

function normalizeIssRatePct(...sources) {
  for (const source of sources) {
    const n = toNum(source);
    if (n === null || n < 0) continue;
    return n <= 1 ? n * 100 : n;
  }
  return null;
}

function resolveIssRatePct({ issRatePct, issRate, amount, iss }) {
  const explicit = normalizeIssRatePct(issRatePct, issRate);
  if (explicit !== null) return explicit;

  const amountNum = toNum(amount);
  const issNum = toNum(iss);
  if (amountNum !== null && amountNum > 0 && issNum !== null) {
    return (issNum / amountNum) * 100;
  }

  return DEFAULT_ISS_RATE * 100;
}

function resolveInvoiceInputs(options) {
  if (!Array.isArray(options.invoices)) return null;

  const invoices = [];
  for (const invoice of options.invoices) {
    const amount = toNum(invoice?.amount ?? invoice?.valor ?? invoice?.invoicedAmount);
    if (amount === null || amount <= 0) continue;
    let invoiceIss = toNum(invoice?.iss ?? invoice?.valorIss ?? invoice?.invoiceIss);
    const serviceTaxCode = resolveServiceTaxCode(
      invoice?.serviceTaxCode,
      invoice?.codigoLc116,
      invoice?.codigoLC116,
      invoice?.CodigoLC116,
      invoice?.codigoServico,
      invoice?.CodigoServico,
      invoice,
      options.serviceTaxCode,
      options.components
    );
    const omieServiceTaxCode = normalizeOmieServiceTaxCode(invoice?.serviceTaxCode)
      ?? normalizeOmieServiceTaxCode(invoice?.codigoLc116)
      ?? normalizeOmieServiceTaxCode(invoice?.codigoLC116)
      ?? normalizeOmieServiceTaxCode(invoice?.CodigoLC116)
      ?? normalizeOmieServiceTaxCode(invoice?.codigoServico)
      ?? normalizeOmieServiceTaxCode(invoice?.CodigoServico)
      ?? serviceTaxCode;
    const ignoreIss = ignoresIss(omieServiceTaxCode);
    if (ignoreIss) invoiceIss = 0;
    const issRatePct = ignoreIss ? 0 : resolveIssRatePct({
      issRatePct: invoice?.issRatePct ?? invoice?.aliquotaIss ?? invoice?.nAliquotaISS,
      issRate: invoice?.issRate,
      amount,
      iss: invoiceIss
    });
    invoices.push({ amount, invoiceIss, serviceTaxCode, omieServiceTaxCode, issRatePct });
  }

  return invoices.length > 0 ? invoices : null;
}

function buildTaxLine(amount, serviceTaxCode, issRatePct, omieServiceTaxCode = null) {
  const rule = SERVICE_TAX_RULES[serviceTaxCode] ?? SERVICE_TAX_RULES[DEFAULT_SERVICE_TAX_CODE];
  const effectiveIssRatePct = ignoresIss(omieServiceTaxCode) ? 0 : issRatePct;
  const issRate = effectiveIssRatePct / 100;
  const iss = amount * issRate;
  const pis = amount * PIS_RATE;
  const cofins = amount * COFINS_RATE;
  const irpjPresumedBasis = amount * rule.irpjPresumptionRate;
  const csllPresumedBasis = amount * rule.csllPresumptionRate;
  const irpjBasic = irpjPresumedBasis * IRPJ_RATE;
  const csll = csllPresumedBasis * CSLL_RATE;
  const additionalIrpjEstimated = Math.max(irpjPresumedBasis - ADDITIONAL_IRPJ_THRESHOLD, 0) * ADDITIONAL_IRPJ_RATE;
  const irpjTotal = irpjBasic + additionalIrpjEstimated;
  const irpjCsllTotal = irpjTotal + csll;

  return {
    rule,
    omieServiceTaxCode: omieServiceTaxCode ?? rule.serviceTaxCode,
    amount,
    issRatePct: effectiveIssRatePct,
    iss,
    pis,
    cofins,
    invoiceTaxTotal: iss + pis + cofins,
    irpjPresumedBasis,
    csllPresumedBasis,
    irpjBasic,
    csll,
    additionalIrpjEstimated,
    irpjTotal,
    irpjCsllTotal,
    minimumOutOfInvoiceTaxTotal: irpjBasic + csll
  };
}

function sumLines(lines, key) {
  return lines.reduce((total, line) => total + line[key], 0);
}

function combineServiceTaxMetadata(lines) {
  const serviceTaxCodes = [...new Set(lines.map(line => line.rule.serviceTaxCode))];
  const omieServiceTaxCodes = [...new Set(lines.map(line => line.omieServiceTaxCode).filter(Boolean))];
  const equivalentServiceTaxCodes = [...new Set(lines.map(line => line.rule.equivalentServiceTaxCode).filter(Boolean))];
  if (serviceTaxCodes.length === 1) {
    const rule = lines[0].rule;
    return {
      serviceTaxCode: rule.serviceTaxCode,
      equivalentServiceTaxCode: rule.equivalentServiceTaxCode ?? null,
      spreadsheetBlock: rule.spreadsheetBlock,
      serviceTaxCodes,
      omieServiceTaxCodes
    };
  }

  return {
    serviceTaxCode: 'MIXED',
    equivalentServiceTaxCode: equivalentServiceTaxCodes.length === 1 ? equivalentServiceTaxCodes[0] : null,
    spreadsheetBlock: 'MULTIPLOS_CODIGOS_OMIE',
    serviceTaxCodes,
    omieServiceTaxCodes
  };
}

export function buildPresumedProfitTaxEstimate(salePrice, options = {}) {
  const expectedSale = toNum(salePrice);
  const invoiceInputs = resolveInvoiceInputs(options);
  const invoicedAmount = invoiceInputs
    ? invoiceInputs.reduce((total, invoice) => total + invoice.amount, 0)
    : toNum(options.invoicedAmount);
  const basis = invoicedAmount !== null && invoicedAmount > 0 ? invoicedAmount : expectedSale;
  if (basis === null || basis <= 0) return null;

  const serviceTaxCode = resolveServiceTaxCode(options.serviceTaxCode, options.components);
  const basisSource = invoicedAmount !== null && invoicedAmount > 0 ? 'OMIE_INVOICED' : 'EXPECTED_SALE';
  const omieIss = invoiceInputs
    ? (invoiceInputs.some(invoice => invoice.invoiceIss !== null)
      ? invoiceInputs.reduce((total, invoice) => total + (invoice.invoiceIss ?? 0), 0)
      : null)
    : toNum(options.invoiceIss);
  const lines = invoiceInputs
    ? invoiceInputs.map(invoice => buildTaxLine(invoice.amount, invoice.serviceTaxCode, invoice.issRatePct, invoice.omieServiceTaxCode))
    : [buildTaxLine(basis, serviceTaxCode, resolveIssRatePct({
      issRatePct: options.issRatePct ?? options.aliquotaIss,
      issRate: options.issRate,
      amount: basis,
      iss: omieIss
    }), serviceTaxCode)];
  const serviceTaxMetadata = combineServiceTaxMetadata(lines);

  const iss = sumLines(lines, 'iss');
  const pis = sumLines(lines, 'pis');
  const cofins = sumLines(lines, 'cofins');
  const invoiceTaxTotal = sumLines(lines, 'invoiceTaxTotal');
  const irpjPresumedBasis = sumLines(lines, 'irpjPresumedBasis');
  const csllPresumedBasis = sumLines(lines, 'csllPresumedBasis');
  const irpjBasic = sumLines(lines, 'irpjBasic');
  const csll = sumLines(lines, 'csll');
  const additionalIrpjEstimated = sumLines(lines, 'additionalIrpjEstimated');
  const irpjTotal = sumLines(lines, 'irpjTotal');
  const irpjCsllTotal = sumLines(lines, 'irpjCsllTotal');
  const minimumOutOfInvoiceTaxTotal = sumLines(lines, 'minimumOutOfInvoiceTaxTotal');
  const minimumTotal = invoiceTaxTotal + minimumOutOfInvoiceTaxTotal;
  const probableTotal = minimumTotal + additionalIrpjEstimated;
  const effectiveTaxPct = (probableTotal / basis) * 100;
  const minimumEffectivePct = (minimumTotal / basis) * 100;
  const invoiceTaxEffectivePct = (invoiceTaxTotal / basis) * 100;
  const irpjCsllEffectivePct = (irpjCsllTotal / basis) * 100;
  const issRatePct = (iss / basis) * 100;
  const irpjPresumptionPct = (irpjPresumedBasis / basis) * 100;
  const csllPresumptionPct = (csllPresumedBasis / basis) * 100;

  return {
    ...PRESUMED_PROFIT_TAX_ASSUMPTIONS,
    issRatePct: roundPct(issRatePct),
    ...serviceTaxMetadata,
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
    irpjPresumptionPct: roundPct(irpjPresumptionPct),
    csllPresumptionPct: roundPct(csllPresumptionPct),
    presumptionPct: roundPct(irpjPresumptionPct),
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
