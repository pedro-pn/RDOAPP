import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSedeCostCards, SEDE_OMIE_CODES } from '../src/lib/acompanhamento/sede-costs.js';

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
