import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactText,
  excelSerialToDateKey,
  normalizeDuration,
  normalizeTime,
  parseReportFieldsFromOcrText,
  parseReportFileName,
  resolveCollaboratorsForAllocations,
  resolveCollaboratorName
} from '../scripts/import-manual-rdo-pdfs.js';

test('import manual RDO parser reads expected fields from OCR text', () => {
  const fields = parseReportFieldsFromOcrText(`
    RDO nº: 21 Data: 04/02/2026
    Entrada: 7:00
    Saída: 17:22
    Serviço: montagem de estruturas Início: 08:30 Término: 12:15
    Stand-by: 01:30
    Motivo standby: Aguardando liberação da área
  `);

  assert.equal(fields.sequenceNumber, 21);
  assert.equal(fields.reportDate, '2026-02-04');
  assert.equal(fields.arrivalTime, '07:00');
  assert.equal(fields.departureTime, '17:22');
  assert.equal(fields.serviceStartTime, '08:30');
  assert.equal(fields.serviceEndTime, '12:15');
  assert.deepEqual(fields.standby, {
    enabled: true,
    total: '01:30:00',
    motivo: 'Aguardando liberacao da area'
  });
});

test('import manual RDO parser can use service times as operational times', () => {
  const fields = parseReportFieldsFromOcrText(
    'RDO nº: 35 Data: 18/02/2026 Entrada: 06:55 Saída: 17:01 Início: 08:00 Término: 15:45',
    {},
    { timeSource: 'servico' }
  );

  assert.equal(fields.arrivalTime, '08:00');
  assert.equal(fields.departureTime, '15:45');
});

test('import manual RDO filename and date helpers normalize common formats', () => {
  assert.deepEqual(parseReportFileName('AFONSO RDO 21 - 04-02-2026.pdf'), {
    sequenceNumber: 21,
    reportDate: '2026-02-04'
  });
  assert.equal(excelSerialToDateKey(46057), '2026-02-04');
  assert.equal(normalizeTime('7:05'), '07:05');
  assert.equal(normalizeDuration('125 min'), '02:05:00');
  assert.equal(compactText('Missão 5719 - Ilha Solteira'), 'missao5719ilhasolteira');
});

test('import manual RDO collaborator resolver reports exact, fuzzy and ambiguous names', () => {
  const collaborators = [
    { id: 'c1', code: 'COL-001', name: 'Adailton Batista Santos', isActive: true },
    { id: 'c2', code: 'COL-002', name: 'Joelison dos Santos de Almeida', isActive: true },
    { id: 'c3', code: 'COL-003', name: 'Wolney Rocha Cabral Santos', isActive: true },
    { id: 'c4', code: 'COL-004', name: 'Wolney Rocha Cabral Santos', isActive: true }
  ];

  assert.equal(resolveCollaboratorName('Adailton Batista Santos', collaborators).strategy, 'exact');
  assert.deepEqual(
    {
      status: resolveCollaboratorName('Joelisson', collaborators).status,
      strategy: resolveCollaboratorName('Joelisson', collaborators).strategy
    },
    { status: 'matched', strategy: 'near-first-token' }
  );

  const ambiguous = resolveCollaboratorName('Wolney', collaborators);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.candidates.length, 2);

  const aliased = resolveCollaboratorName(
    'Rodrigo Caruso',
    collaborators,
    new Map([[compactText('Rodrigo Caruso'), 'COL-003']])
  );
  assert.equal(aliased.status, 'matched');
  assert.equal(aliased.collaborator.id, 'c3');
  assert.equal(aliased.strategy, 'alias');
});

test('import manual RDO allocation resolver can ignore spreadsheet collaborators', () => {
  const allocations = new Map([
    ['2026-02-04', [
      { name: 'Rodrigo Caruso', sheet: 'Fev26', row: 6, projectText: 'Ilha solteira' },
      { name: 'Adailton', sheet: 'Fev26', row: 6, projectText: 'Ilha solteira' }
    ]]
  ]);
  const collaborators = [
    { id: 'c1', code: 'COL-001', name: 'Adailton Batista Santos', isActive: true },
    { id: 'c2', code: 'COL-002', name: 'Rodrigo Fernandes de Souza', isActive: true },
    { id: 'c3', code: 'COL-003', name: 'Rodrigo Gomes dos Santos', isActive: true }
  ];

  const resolved = resolveCollaboratorsForAllocations(allocations, collaborators, {
    ignoredCollaborators: new Set([compactText('Rodrigo Caruso')])
  }).get('2026-02-04');

  assert.deepEqual(resolved.collaboratorIds, ['c1']);
  assert.deepEqual(resolved.matches.map(match => match.input), ['Adailton']);
  assert.deepEqual(resolved.ignored.map(item => item.input), ['Rodrigo Caruso']);
  assert.deepEqual(resolved.issues, []);
});
