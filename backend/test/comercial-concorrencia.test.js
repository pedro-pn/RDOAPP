import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONCURRENT_WRITE_CODE,
  ConcurrentWriteError,
  assertNoConcurrentWrite
} from '../src/lib/comercial/access.js';
import { exigirNaoFinalizada, finalizarProposta } from '../src/lib/comercial/jobs.js';
import { updateProposal } from '../src/lib/comercial/proposals.js';

/** Concorrência comercial — T079b + os dois casos da T110a. */

const gestor = {
  id: 'u-gestor',
  name: 'Gestora Maria',
  moduleRoles: ['comercial:manager']
};

const abertaEm = new Date('2026-08-13T12:00:00.000Z');
const alteradaEm = new Date('2026-08-13T12:05:00.000Z');

function proposta(extra = {}) {
  return {
    id: 'p1',
    proposalCode: '4418',
    revisionNumber: 0,
    costEstimateId: null,
    clientName: 'Cliente',
    cnpj: '33.000.167/0001-01',
    contact: 'Contato',
    email: 'contato@cliente.com',
    site: 'Macaé',
    department: null,
    sellerUserId: 'u-vendedor',
    sellerName: 'Vendedor',
    payload: { prices: [] },
    status: 'RASCUNHO',
    archivedAt: null,
    createdByUserId: 'u-vendedor',
    updatedAt: abertaEm,
    updatedByUserId: null,
    updatedByLabel: null,
    ...extra
  };
}

test('salvar registro alterado desde a abertura devolve 409 com autor e data', () => {
  assert.throws(
    () =>
      assertNoConcurrentWrite(
        proposta({
          updatedAt: alteradaEm,
          updatedByUserId: 'u-colega',
          updatedByLabel: 'Colega Ana'
        }),
        { expectedUpdatedAt: abertaEm.toISOString() }
      ),
    error => {
      assert.ok(error instanceof ConcurrentWriteError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, CONCURRENT_WRITE_CODE);
      assert.match(error.message, /Colega Ana/);
      assert.match(error.message, /13\/08\/2026/);
      assert.equal(error.conflict.updatedAt, alteradaEm.toISOString());
      return true;
    }
  );
});

test('a confirmação explícita permite prosseguir — o aviso não vira trava', () => {
  assert.equal(
    assertNoConcurrentWrite(proposta({ updatedAt: alteradaEm }), {
      expectedUpdatedAt: abertaEm.toISOString(),
      forceOverwrite: true
    }),
    false
  );
});

test('o update grava quem editou e mantém updatedAt na condição atômica', async () => {
  const row = proposta();
  let whereRecebido;
  const prisma = {
    proposal: {
      findUnique: async () => row,
      update: async ({ where, data }) => {
        whereRecebido = where;
        Object.assign(row, data);
        return row;
      }
    }
  };

  await updateProposal(prisma, gestor, row.id, {
    expectedUpdatedAt: abertaEm.toISOString(),
    clientName: 'Cliente atualizado'
  });

  assert.deepEqual(whereRecebido, { id: 'p1', updatedAt: abertaEm });
  assert.equal(row.updatedByUserId, gestor.id);
  assert.equal(row.updatedByLabel, gestor.name);
});

test('mudança entre o SELECT e o UPDATE também é detectada', async () => {
  const antes = proposta();
  const depois = proposta({
    updatedAt: alteradaEm,
    updatedByUserId: 'u-colega',
    updatedByLabel: 'Colega Ana'
  });
  let leituras = 0;
  const prisma = {
    proposal: {
      findUnique: async () => (++leituras === 1 ? antes : depois),
      update: async () => {
        const error = new Error('Record to update not found.');
        error.code = 'P2025';
        throw error;
      }
    }
  };

  await assert.rejects(
    () =>
      updateProposal(prisma, gestor, antes.id, {
        expectedUpdatedAt: abertaEm.toISOString(),
        clientName: 'Minha edição'
      }),
    error =>
      error instanceof ConcurrentWriteError &&
      error.conflict.updatedByLabel === 'Colega Ana'
  );
});

test('finalizar proposta já finalizada nomeia autor e data', () => {
  assert.throws(
    () =>
      exigirNaoFinalizada(
        proposta({
          status: 'FINALIZADA',
          finalizedAt: alteradaEm,
          finalizedByUserId: 'u-colega',
          finalizedByLabel: 'Colega Ana'
        })
      ),
    error => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /Colega Ana/);
      assert.match(error.message, /13\/08\/2026/);
      return true;
    }
  );
});

test('duas finalizações que leram RASCUNHO não atravessam juntas o UPDATE', async () => {
  const antes = proposta();
  const depois = proposta({
    status: 'FINALIZANDO',
    finalizedAt: alteradaEm,
    finalizedByUserId: 'u-colega',
    finalizedByLabel: 'Colega Ana'
  });
  let leituras = 0;
  const prisma = {
    proposal: {
      findUnique: async () => (++leituras === 1 ? antes : depois),
      update: async () => {
        const error = new Error('Record to update not found.');
        error.code = 'P2025';
        throw error;
      }
    }
  };

  await assert.rejects(
    () =>
      finalizarProposta(prisma, gestor, 'p1', {
        gerarPdf: async () => Buffer.from('%PDF')
      }),
    error => error.statusCode === 409 && /Colega Ana/.test(error.message)
  );
});
