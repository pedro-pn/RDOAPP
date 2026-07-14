import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSedeCostCards, SEDE_OMIE_CODES } from '../src/lib/acompanhamento/sede-costs.js';
import { parseSedeCostRangeQuery } from '../src/routes/resources/acompanhamento-comercial.js';

function zodMessages(fn) {
  try {
    fn();
  } catch (error) {
    return (error.issues ?? []).map(issue => issue.message);
  }
  assert.fail('Esperava erro de validação.');
}

test('buildSedeCostCards agrega custos mensais por código fixo da sede', () => {
  const data = buildSedeCostCards([
    {
      codigoProjeto: '8056369140',
      osNumber: '5002',
      valor: '100.50',
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Aluguel',
      dataPrevisao: new Date('2026-07-05T00:00:00Z')
    },
    {
      codigoProjeto: '8056369140',
      osNumber: '5002',
      valor: 25,
      statusTitulo: 'ABERTO',
      categoriaDescricao: 'Energia',
      dataVencimento: new Date('2026-07-20T00:00:00Z')
    },
    {
      codigoProjeto: '5003',
      valor: 200,
      statusTitulo: 'ABERTO',
      categoriaDescricao: 'Manutenção',
      dataEmissao: new Date('2026-06-10T00:00:00Z')
    },
    {
      codigoProjeto: '9999',
      valor: 999,
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Ignorado',
      dataPrevisao: new Date('2026-07-01T00:00:00Z')
    }
  ], { now: new Date('2026-07-10T00:00:00Z') });

  assert.deepEqual(data.codes, SEDE_OMIE_CODES);
  assert.equal(data.cards.length, 3);
  assert.equal(data.summary.total, 325.5);
  assert.equal(data.summary.currentMonthTotal, 125.5);
  assert.equal(data.summary.count, 3);

  const sede5002 = data.cards.find(card => card.code === '5002');
  assert.equal(sede5002.total, 125.5);
  assert.equal(sede5002.paidTotal, 100.5);
  assert.equal(sede5002.openTotal, 25);
  assert.deepEqual(sede5002.monthly.map(month => [month.month, month.total]), [['2026-07', 125.5]]);
  assert.deepEqual(sede5002.topCategories.map(category => category.categoria).sort(), ['Aluguel', 'Energia']);

  const sede5000 = data.cards.find(card => card.code === '5000');
  assert.equal(sede5000.total, 0);
  assert.deepEqual(sede5000.monthly, []);
});

test('buildSedeCostCards filtra agregados por intervalo e preserva meses disponíveis', () => {
  const purchases = [
    {
      codigoProjeto: '5002',
      valor: 100,
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Aluguel',
      dataPrevisao: new Date('2026-01-10T00:00:00Z')
    },
    {
      codigoProjeto: '5002',
      valor: 200,
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Aluguel',
      dataPrevisao: new Date('2026-03-05T00:00:00Z')
    },
    {
      codigoProjeto: '5002',
      valor: 50,
      statusTitulo: 'ABERTO',
      categoriaDescricao: 'Energia',
      dataVencimento: new Date('2026-03-20T00:00:00Z')
    },
    {
      codigoProjeto: '5002',
      valor: 70,
      statusTitulo: 'ABERTO',
      categoriaDescricao: 'Energia',
      dataEmissao: new Date('2026-04-01T00:00:00Z')
    },
    {
      codigoProjeto: '5002',
      valor: 30,
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Sem data'
    },
    {
      codigoProjeto: '5003',
      valor: 90,
      statusTitulo: 'ABERTO',
      categoriaDescricao: 'Manutenção',
      dataPrevisao: new Date('2026-03-25T00:00:00Z')
    }
  ];

  const all = buildSedeCostCards(purchases, { now: new Date('2026-07-10T00:00:00Z') });
  const ranged = buildSedeCostCards(purchases, {
    now: new Date('2026-07-10T00:00:00Z'),
    range: { fromMonth: '2026-03', toMonth: '2026-03' }
  });

  assert.deepEqual(all.availableMonths, ['2026-01', '2026-03', '2026-04']);
  assert.deepEqual(ranged.availableMonths, ['2026-01', '2026-03', '2026-04']);
  assert.equal(all.summary.total, 540);
  assert.equal(ranged.summary.total, 340);
  assert.equal(ranged.summary.paidTotal, 200);
  assert.equal(ranged.summary.openTotal, 140);
  assert.equal(ranged.summary.count, 3);
  assert.equal(
    ranged.cards.reduce((sum, card) => sum + card.total, 0),
    ranged.summary.total
  );

  const all5002 = all.cards.find(card => card.code === '5002');
  assert.equal(all5002.monthly.find(month => month.month === 'sem-data')?.total, 30);
  assert.equal(all5002.monthly.find(month => month.month === '2026-03')?.total, 250);

  const sede5002 = ranged.cards.find(card => card.code === '5002');
  assert.equal(sede5002.total, 250);
  assert.equal(sede5002.total, all5002.monthly.find(month => month.month === '2026-03')?.total);
  assert.equal(sede5002.paidTotal, 200);
  assert.equal(sede5002.openTotal, 50);
  assert.equal(sede5002.count, 2);
  assert.equal(sede5002.lastPurchaseDate, '2026-03-20T00:00:00.000Z');
  assert.deepEqual(sede5002.monthly.map(month => [month.month, month.total, month.count]), [
    ['2026-03', 250, 2]
  ]);
  assert.deepEqual(sede5002.topCategories.map(category => [category.categoria, category.total, category.count]), [
    ['Aluguel', 200, 1],
    ['Energia', 50, 1]
  ]);

  const sede5003 = ranged.cards.find(card => card.code === '5003');
  assert.equal(sede5003.total, 90);
  assert.deepEqual(sede5003.monthly.map(month => [month.month, month.total]), [['2026-03', 90]]);
});

test('buildSedeCostCards mostra todos os meses por padrão na visão de todo o período', () => {
  const purchases = Array.from({ length: 14 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0');
    const year = index < 12 ? '2025' : '2026';
    const effectiveMonth = index < 12 ? month : String(index - 11).padStart(2, '0');
    return {
      codigoProjeto: '5002',
      valor: 10,
      statusTitulo: 'PAGO',
      categoriaDescricao: 'Aluguel',
      dataPrevisao: new Date(`${year}-${effectiveMonth}-01T00:00:00Z`)
    };
  });

  const all = buildSedeCostCards(purchases, { now: new Date('2026-07-10T00:00:00Z') });
  const limited = buildSedeCostCards(purchases, { now: new Date('2026-07-10T00:00:00Z'), monthsLimit: 12 });
  const sede5002All = all.cards.find(card => card.code === '5002');
  const sede5002Limited = limited.cards.find(card => card.code === '5002');

  assert.equal(sede5002All.monthly.length, 14);
  assert.equal(sede5002Limited.monthly.length, 12);
  assert.equal(all.summary.total, 140);
  assert.equal(limited.summary.total, 140);
});

test('parseSedeCostRangeQuery valida from/to como par de meses', () => {
  assert.equal(parseSedeCostRangeQuery({}), null);
  assert.deepEqual(parseSedeCostRangeQuery({ from: '2026-01', to: '2026-03' }), {
    fromMonth: '2026-01',
    toMonth: '2026-03'
  });

  assert.match(
    zodMessages(() => parseSedeCostRangeQuery({ from: '2026-02', to: '2026-01' })).join('\n'),
    /Período inválido: mês final anterior ao inicial\./
  );
  assert.match(
    zodMessages(() => parseSedeCostRangeQuery({ from: '2026-01' })).join('\n'),
    /Informe mês inicial e final para filtrar a Sede\./
  );
  assert.match(
    zodMessages(() => parseSedeCostRangeQuery({ from: '2026-13', to: '2026-13' })).join('\n'),
    /Mês inválido\. Use o formato YYYY-MM\./
  );
});
