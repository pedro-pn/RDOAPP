import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPresumedProfitTaxEstimate,
  normalizeServiceTaxCode,
  PRESUMED_PROFIT_TAX_ASSUMPTIONS,
  resolveServiceTaxCode
} from '../src/lib/acompanhamento/presumed-profit-taxes.js';

test('buildPresumedProfitTaxEstimate calcula impostos da planilha para codigo 7.05 por padrao', () => {
  assert.deepEqual(buildPresumedProfitTaxEstimate(100000), {
    ...PRESUMED_PROFIT_TAX_ASSUMPTIONS,
    serviceTaxCode: '7.05',
    equivalentServiceTaxCode: null,
    spreadsheetBlock: '7.05 + 10% Tributacao 2026',
    serviceTaxCodes: ['7.05'],
    omieServiceTaxCodes: ['7.05'],
    basisSource: 'EXPECTED_SALE',
    basisAmount: 100000,
    expectedSalePrice: 100000,
    invoicedAmount: null,
    salePrice: 100000,
    iss: 3000,
    omieIss: null,
    issDelta: null,
    pis: 650,
    cofins: 3000,
    inss: 0,
    invoiceTaxTotal: 6650,
    irpjPresumedBasis: 8800,
    csllPresumedBasis: 13200,
    presumedBasis: 8800,
    irpjPresumptionPct: 8.8,
    csllPresumptionPct: 13.2,
    presumptionPct: 8.8,
    irpjBasic: 1320,
    csll: 1188,
    additionalIrpjEstimated: 880,
    irpjTotal: 2200,
    irpjCsllTotal: 3388,
    outOfInvoiceTaxTotal: 3388,
    estimatedProjectTaxCost: 3388,
    totalTax: 10038,
    netAfterTaxes: 89962,
    netAfterOutOfInvoiceTaxes: 96612,
    minimumOutOfInvoiceTaxTotal: 2508,
    minimumTotal: 9158,
    probableTotal: 10038,
    minimumEffectivePct: 9.16,
    probableEffectivePct: 10.04,
    effectiveTaxPct: 10.04,
    invoiceTaxEffectivePct: 6.65,
    inssRatePct: 0,
    irpjCsllEffectivePct: 3.39
  });
});

test('buildPresumedProfitTaxEstimate trata 7.02 como mesma regra de 7.05', () => {
  const out = buildPresumedProfitTaxEstimate(100000, { serviceTaxCode: '7.02' });

  assert.equal(out.serviceTaxCode, '7.02');
  assert.equal(out.equivalentServiceTaxCode, '7.05');
  assert.equal(out.spreadsheetBlock, '7.05 + 10% Tributacao 2026');
  assert.equal(out.inss, 5500);
  assert.equal(out.inssRatePct, 5.5);
  assert.equal(out.invoiceTaxTotal, 12150);
  assert.equal(out.probableTotal, 15538);
  assert.equal(out.irpjCsllTotal, 3388);
  assert.equal(out.outOfInvoiceTaxTotal, 3388);
});

test('buildPresumedProfitTaxEstimate calcula codigo 14.01 pela base maior da planilha', () => {
  const out = buildPresumedProfitTaxEstimate(100000, { serviceTaxCode: '14.01' });

  assert.equal(out.serviceTaxCode, '14.01');
  assert.equal(out.iss, 3000);
  assert.equal(out.pis, 650);
  assert.equal(out.cofins, 3000);
  assert.equal(out.inss, 5500);
  assert.equal(out.irpjPresumedBasis, 35000);
  assert.equal(out.csllPresumedBasis, 35000);
  assert.equal(out.irpjBasic, 5250);
  assert.equal(out.csll, 3150);
  assert.equal(out.additionalIrpjEstimated, 3500);
  assert.equal(out.irpjCsllTotal, 11900);
  assert.equal(out.outOfInvoiceTaxTotal, 11900);
  assert.equal(out.probableTotal, 24050);
  assert.equal(out.probableEffectivePct, 24.05);
});

test('buildPresumedProfitTaxEstimate usa faturamento real do Omie quando existir', () => {
  const out = buildPresumedProfitTaxEstimate(100000, { invoicedAmount: 120000, invoiceIss: 3600 });

  assert.equal(out.basisSource, 'OMIE_INVOICED');
  assert.equal(out.expectedSalePrice, 100000);
  assert.equal(out.invoicedAmount, 120000);
  assert.equal(out.basisAmount, 120000);
  assert.equal(out.iss, 3600);
  assert.equal(out.omieIss, 3600);
  assert.equal(out.issDelta, 0);
  assert.equal(out.invoiceTaxTotal, 7980);
  assert.equal(out.outOfInvoiceTaxTotal, 4065.6);
  assert.equal(out.totalTax, 12045.6);
});

test('buildPresumedProfitTaxEstimate deriva aliquota efetiva do ISS Omie quando percentual nao vem destacado', () => {
  const out = buildPresumedProfitTaxEstimate(100000, { invoiceIss: 5000 });

  assert.equal(out.basisSource, 'EXPECTED_SALE');
  assert.equal(out.issRatePct, 5);
  assert.equal(out.iss, 5000);
  assert.equal(out.omieIss, 5000);
  assert.equal(out.issDelta, 0);
});

test('buildPresumedProfitTaxEstimate usa aliquota ISS informada pelo Omie', () => {
  const out = buildPresumedProfitTaxEstimate(100000, { serviceTaxCode: '14.01', issRatePct: 2 });

  assert.equal(out.serviceTaxCode, '14.01');
  assert.deepEqual(out.serviceTaxCodes, ['14.01']);
  assert.deepEqual(out.omieServiceTaxCodes, ['14.01']);
  assert.equal(out.issRatePct, 2);
  assert.equal(out.iss, 2000);
  assert.equal(out.inss, 5500);
  assert.equal(out.invoiceTaxTotal, 11150);
  assert.equal(out.irpjCsllTotal, 11900);
  assert.equal(out.probableTotal, 23050);
});

test('buildPresumedProfitTaxEstimate soma faturamentos Omie por codigo fiscal e aliquota de ISS', () => {
  const out = buildPresumedProfitTaxEstimate(100000, {
    components: { codigoServicoFiscal: '14.01' },
    invoices: [
      { amount: 40000, iss: 800, issRatePct: 2, serviceTaxCode: '7.05' },
      { amount: 60000, iss: 3000, issRatePct: 5, serviceTaxCode: '14.01' }
    ]
  });

  assert.equal(out.basisSource, 'OMIE_INVOICED');
  assert.equal(out.serviceTaxCode, 'MIXED');
  assert.deepEqual(out.serviceTaxCodes, ['7.05', '14.01']);
  assert.deepEqual(out.omieServiceTaxCodes, ['7.05', '14.01']);
  assert.equal(out.issRatePct, 3.8);
  assert.equal(out.inssRatePct, 3.3);
  assert.equal(out.iss, 3800);
  assert.equal(out.inss, 3300);
  assert.equal(out.omieIss, 3800);
  assert.equal(out.irpjPresumedBasis, 24520);
  assert.equal(out.csllPresumedBasis, 26280);
  assert.equal(out.irpjCsllTotal, 8495.2);
  assert.equal(out.probableTotal, 19245.2);
});

test('buildPresumedProfitTaxEstimate preserva codigo Omie sem regra de presuncao conhecida', () => {
  const out = buildPresumedProfitTaxEstimate(100000, {
    invoices: [
      { amount: 10000, iss: 500, issRatePct: 5, serviceTaxCode: '99.01' }
    ]
  });

  assert.equal(out.serviceTaxCode, '7.05');
  assert.deepEqual(out.serviceTaxCodes, ['7.05']);
  assert.deepEqual(out.omieServiceTaxCodes, ['99.01']);
  assert.equal(out.issRatePct, 0);
  assert.equal(out.iss, 0);
  assert.equal(out.omieIss, 0);
  assert.equal(out.invoiceTaxTotal, 365);
});

test('buildPresumedProfitTaxEstimate arredonda centavos e aceita texto numerico', () => {
  const out = buildPresumedProfitTaxEstimate('12345.67');

  assert.equal(out.salePrice, 12345.67);
  assert.equal(out.iss, 370.37);
  assert.equal(out.pis, 80.25);
  assert.equal(out.cofins, 370.37);
  assert.equal(out.invoiceTaxTotal, 820.99);
  assert.equal(out.irpjPresumedBasis, 1086.42);
  assert.equal(out.csllPresumedBasis, 1629.63);
  assert.equal(out.irpjBasic, 162.96);
  assert.equal(out.csll, 146.67);
  assert.equal(out.additionalIrpjEstimated, 108.64);
  assert.equal(out.irpjCsllTotal, 418.27);
  assert.equal(out.outOfInvoiceTaxTotal, 418.27);
  assert.equal(out.minimumTotal, 1130.62);
  assert.equal(out.probableTotal, 1239.26);
});

test('buildPresumedProfitTaxEstimate ignora venda ausente ou zerada', () => {
  assert.equal(buildPresumedProfitTaxEstimate(null), null);
  assert.equal(buildPresumedProfitTaxEstimate(0), null);
  assert.equal(buildPresumedProfitTaxEstimate(-1), null);
  assert.equal(buildPresumedProfitTaxEstimate('abc'), null);
});

test('resolveServiceTaxCode normaliza codigos informados em texto ou componentes', () => {
  assert.equal(normalizeServiceTaxCode('codigo 14,01'), '14.01');
  assert.equal(normalizeServiceTaxCode('070202'), '7.02');
  assert.equal(resolveServiceTaxCode({ codigoServicoFiscal: '7.02' }), '7.02');
  assert.equal(resolveServiceTaxCode({ qualquer: 'sem codigo' }), '7.05');
});
