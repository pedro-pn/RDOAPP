import assert from 'node:assert/strict';
import test from 'node:test';

import AdmZip from 'adm-zip';

import { parsePonto, hmToMinutes } from '../src/lib/acompanhamento/ponto-parser.js';
import { normalizeName } from '../src/lib/acompanhamento/ponto-import.js';

// Monta um .xlsx mínimo (strings inline) para exercitar o parser sem arquivo externo.
function cell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
}
function row(n, cells) {
  return `<row r="${n}">${Object.entries(cells).map(([col, v]) => cell(`${col}${n}`, v)).join('')}</row>`;
}
function columnName(index) {
  let n = index;
  let name = '';
  while (n > 0) {
    n -= 1;
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}
function pontoHeader(pairCount) {
  const cells = { A: 'Data' };
  let index = 2;
  for (let pair = 1; pair <= pairCount; pair += 1) {
    cells[columnName(index)] = `${pair}ª Entrada`;
    index += 1;
    cells[columnName(index)] = `${pair}ª Saída`;
    index += 1;
  }
  const cols = {};
  for (const [key, label] of [
    ['credit', 'Crédito'],
    ['debit', 'Débito'],
    ['interval', 'H. intervalo'],
    ['normal', 'Horas normais'],
    ['extras', 'Horas extras acumulativas'],
    ['factor1', 'Horas extras fator 1'],
    ['night', 'Adicional noturno'],
    ['reason', 'Motivo/Observação']
  ]) {
    const col = columnName(index);
    cells[col] = label;
    cols[key] = col;
    index += 1;
  }
  return { cells, cols };
}
function buildXlsx(rows) {
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows.join('') +
    '</sheetData></worksheet>';
  const zip = new AdmZip();
  zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(sheet, 'utf8'));
  return zip.toBuffer();
}

const fixture = buildXlsx([
  row(1, { A: 'Relatório de Jornada' }),
  row(3, { A: 'Colaborador', B: 'João da Silva' }),
  row(4, { A: 'Data', K: 'Horas normais', L: 'Horas extras acumulativas', N: 'Adicional noturno', O: 'Motivo' }),
  row(5, { A: 'Seg, 01/06/2026', K: '08:00', L: '01:00', N: '00:00', O: '' }),
  row(6, { A: 'Ter, 02/06/2026', K: '08:30', L: '00:30', N: '00:12', O: 'Ajuste' }),
  row(7, { A: 'Qua, 03/06/2026', K: '00:00', L: '00:00', N: '00:00', O: 'Folga' }),
  row(8, { A: 'TOTAIS', K: '16:30', L: '01:30' }),
  row(9, { A: 'Resumo', B: 'Totais' }),
  row(10, { A: 'Horas extras acumuladas 70%', B: '01:30' }),
  row(11, { A: 'Horas extras acumuladas 100%', B: '00:00' }),
  row(12, { A: 'Colaborador', B: 'MARIA SOUZA' }),
  row(13, { A: 'Data', K: 'Horas normais', L: 'Horas extras acumulativas', N: 'Adicional noturno', O: 'Motivo' }),
  row(14, { A: 'Qui, 04/06/2026', K: '07:00', L: '00:00', N: '00:00', O: '' }),
  row(15, { A: 'Resumo', B: 'Totais' }),
  row(16, { A: 'Horas extras acumuladas 70%', B: '00:00' }),
  row(17, { A: 'Horas extras acumuladas 100%', B: '02:15' })
]);

test('hmToMinutes lida com horas de múltiplos dígitos e vazios', () => {
  assert.equal(hmToMinutes('183:14'), 183 * 60 + 14);
  assert.equal(hmToMinutes('08:01'), 481);
  assert.equal(hmToMinutes(''), 0);
  assert.equal(hmToMinutes(null), 0);
  assert.equal(hmToMinutes('abc'), 0);
});

test('parsePonto separa blocos por colaborador e soma horas/HE', () => {
  const { blocks, periodStart, periodEnd, rowsRead } = parsePonto(fixture);
  assert.equal(blocks.length, 2);
  assert.equal(periodStart, '2026-06-01');
  assert.equal(periodEnd, '2026-06-04');
  assert.equal(rowsRead, 4); // 3 dias do João + 1 da Maria

  const joao = blocks[0];
  assert.equal(joao.rawName, 'João da Silva');
  assert.equal(joao.workedMinutes, 8 * 60 + (8 * 60 + 30)); // 08:00 + 08:30
  assert.equal(joao.he70Minutes, 90);
  assert.equal(joao.he100Minutes, 0);
  assert.equal(joao.nightMinutes, 12);
  assert.deepEqual(joao.workedDays, ['2026-06-01', '2026-06-02']); // dia de folga (00:00) fora
  assert.equal(joao.periodStart, '2026-06-01');
  assert.equal(joao.periodEnd, '2026-06-03');

  const maria = blocks[1];
  assert.equal(maria.rawName, 'MARIA SOUZA');
  assert.equal(maria.workedMinutes, 7 * 60);
  assert.equal(maria.he100Minutes, 135); // 02:15
});

for (const pairCount of [1, 3, 5, 8, 13]) {
  test(`parsePonto resolve colunas pelo cabeçalho com ${pairCount} pares de entrada/saída`, () => {
    const { cells: header, cols } = pontoHeader(pairCount);
    const buffer = buildXlsx([
      row(1, { A: 'Relatório de Jornada' }),
      row(2, { A: 'Colaborador', B: 'João Cabeçalho' }),
      row(3, header),
      row(4, {
        A: 'Seg, 01/06/2026',
        [cols.normal]: '08:48',
        [cols.extras]: '01:15',
        [cols.night]: '00:20',
        [cols.reason]: 'Saída parcial'
      }),
      row(5, { A: 'Resumo', B: 'Totais' }),
      row(6, { A: 'Horas extras acumuladas 70%', B: '01:15' }),
      row(7, { A: 'Horas extras acumuladas 100%', B: '00:10' })
    ]);

    const { blocks, rowsRead } = parsePonto(buffer);
    assert.equal(rowsRead, 1);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].workedMinutes, 8 * 60 + 48);
    assert.equal(blocks[0].he70Minutes, 75);
    assert.equal(blocks[0].he100Minutes, 10);
    assert.equal(blocks[0].nightMinutes, 20);
    assert.deepEqual(blocks[0].workedDays, ['2026-06-01']);
    assert.equal(blocks[0].days[0].extrasMinutes, 75);
    assert.equal(blocks[0].days[0].motivo, 'Saída parcial');
  });
}

test('parsePonto falha quando a linha Data não informa Horas normais', () => {
  const invalid = buildXlsx([
    row(1, { A: 'Relatório de Jornada' }),
    row(2, { A: 'Colaborador', B: 'João sem cabeçalho' }),
    row(3, { A: 'Data', B: '1ª Entrada', C: '1ª Saída' }),
    row(4, { A: 'Seg, 01/06/2026', B: '08:00', C: '17:00' })
  ]);
  assert.throws(() => parsePonto(invalid), /Horas normais/);
});

test('normalizeName remove acentos, caixa e espaços duplicados', () => {
  assert.equal(normalizeName('João  da   Silva'), 'joao da silva');
  assert.equal(normalizeName('MARIA SOUZA'), 'maria souza');
  assert.equal(normalizeName('Antônio Carlos'), 'antonio carlos');
});
