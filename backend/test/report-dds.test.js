import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDdsDocxFields } from '../src/lib/report-docx.js';

const emptyFields = {
  ddsdaystart: '',
  ddsdayend: '',
  ddsdaythemes: '',
  ddsnightstart: '',
  ddsnightend: '',
  ddsnightthemes: ''
};

test('relatório sem bloco dds sai com todos os campos vazios', () => {
  assert.deepEqual(buildDdsDocxFields({}), emptyFields);
  assert.deepEqual(buildDdsDocxFields(null), emptyFields);
  assert.deepEqual(buildDdsDocxFields({ noturno: true, noturnoDetails: { enabled: true } }), emptyFields);
});

test('dds apenas diurno preenche os campos do dia e deixa noturno vazio', () => {
  const fields = buildDdsDocxFields({
    dds: {
      diurno: {
        enabled: true,
        inicio: '07:00',
        termino: '07:15',
        temas: [
          { id: 't1', name: 'Uso correto de EPI' },
          { id: 't2', name: 'Trabalho em altura' }
        ]
      },
      noturno: { enabled: false, inicio: '', termino: '', temas: [] }
    }
  });

  assert.deepEqual(fields, {
    ddsdaystart: '07:00',
    ddsdayend: '07:15',
    ddsdaythemes: 'Uso correto de EPI, Trabalho em altura',
    ddsnightstart: '',
    ddsnightend: '',
    ddsnightthemes: ''
  });
});

test('dds nos dois turnos preenche todos os campos quando há turno noturno', () => {
  const fields = buildDdsDocxFields({
    noturno: true,
    dds: {
      diurno: { enabled: true, inicio: '07:00', termino: '07:10', temas: [{ id: 't1', name: 'Riscos elétricos' }] },
      noturno: { enabled: true, inicio: '19:00', termino: '19:10', temas: [{ id: 't2', name: 'Espaço confinado' }] }
    }
  });

  assert.equal(fields.ddsdaystart, '07:00');
  assert.equal(fields.ddsdaythemes, 'Riscos elétricos');
  assert.equal(fields.ddsnightstart, '19:00');
  assert.equal(fields.ddsnightend, '19:10');
  assert.equal(fields.ddsnightthemes, 'Espaço confinado');
});

test('dds noturno marcado sem turno noturno ativo sai vazio', () => {
  const fields = buildDdsDocxFields({
    noturno: false,
    dds: {
      diurno: { enabled: false, inicio: '', termino: '', temas: [] },
      noturno: { enabled: true, inicio: '19:00', termino: '19:15', temas: [{ id: 't1', name: 'Içamento de cargas' }] }
    }
  });

  assert.deepEqual(fields, emptyFields);
});

test('temas aceitam snapshot {id, name} e strings legadas, ignorando entradas inválidas', () => {
  const fields = buildDdsDocxFields({
    dds: {
      diurno: {
        enabled: true,
        inicio: '08:00',
        termino: '08:05',
        temas: [{ id: 't1', name: 'Ergonomia e postura' }, 'Hidratação', null, { id: 't2' }]
      }
    }
  });

  assert.equal(fields.ddsdaythemes, 'Ergonomia e postura, Hidratação');
});
