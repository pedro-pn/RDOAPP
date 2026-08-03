import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NumeracaoNaoSemeadaError,
  nextProposalNumber,
  numberingStatus,
  seedNumbering
} from '../src/lib/comercial/numbering.js';

/**
 * Numeração de propostas (tarefas T021 e T053).
 *
 * Prisma falso, como no resto da camada: o que precisa ser provado é a **regra de
 * recusa**, não o `nextval` do Postgres.
 *
 * O que está em jogo: o número emitido aqui vai impresso no documento que chega ao
 * cliente. Emitir antes de saber o maior número já usado produz código repetido — dois
 * clientes com a mesma proposta na mão. Por isso o padrão é recusar.
 */

function prismaFalso({ seededAt = null, seedValue = null } = {}) {
  const chamadas = { sql: [], updates: [] };
  let estado = { id: 'singleton', seededAt, seedValue, seededByLabel: null };
  let sequencia = seedValue || 1;

  return {
    chamadas,
    proposalNumberingState: {
      findUnique: async () => ({ ...estado }),
      update: async ({ data }) => {
        chamadas.updates.push(data);
        estado = { ...estado, ...data };
        return { ...estado };
      }
    },
    $queryRawUnsafe: async (sql, ...params) => {
      chamadas.sql.push({ sql, params });
      if (sql.includes('setval')) {
        sequencia = params[0];
        return [{ setval: params[0] }];
      }
      return [{ numero: sequencia++ }];
    }
  };
}

test('sem semeadura, a numeração RECUSA em vez de emitir', async () => {
  const prisma = prismaFalso();

  await assert.rejects(
    () => nextProposalNumber(prisma),
    error => {
      assert.ok(error instanceof NumeracaoNaoSemeadaError);
      // 503, não 500: não é defeito, é ambiente que ainda não foi preparado.
      assert.equal(error.statusCode, 503);
      return true;
    }
  );

  // E não chegou a tocar a sequence — recusar antes de consumir é o ponto.
  assert.equal(prisma.chamadas.sql.length, 0);
});

test('semeada, emite a partir do número informado', async () => {
  const prisma = prismaFalso();
  await seedNumbering(prisma, { proximoNumero: 4435, rotulo: 'teste' });

  assert.equal(await nextProposalNumber(prisma), 4435);
  assert.equal(await nextProposalNumber(prisma), 4436);
});

test('setval usa is_called = false, senão o primeiro número se perde', async () => {
  // Com `true`, o próximo nextval devolveria 4436 e o 4435 nunca seria emitido.
  const prisma = prismaFalso();
  await seedNumbering(prisma, { proximoNumero: 4435, rotulo: 'teste' });

  const chamada = prisma.chamadas.sql.find(c => c.sql.includes('setval'));
  assert.ok(chamada, 'a semeadura tem de chamar setval');
  assert.match(chamada.sql, /false\)/);
});

test('semear duas vezes é recusado', async () => {
  // Resemear reemitiria números já usados — e o segundo cliente receberia uma
  // proposta com o código do primeiro.
  const prisma = prismaFalso({ seededAt: new Date('2026-08-03'), seedValue: 4435 });

  await assert.rejects(
    () => seedNumbering(prisma, { proximoNumero: 1 }),
    error => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('número de partida inválido é recusado antes de gravar', async () => {
  const prisma = prismaFalso();

  for (const invalido of [0, -5, 1.5, 'abc', null]) {
    await assert.rejects(() => seedNumbering(prisma, { proximoNumero: invalido }));
  }
  assert.equal(prisma.chamadas.updates.length, 0);
});

test('o estado diz se já foi semeada', async () => {
  assert.deepEqual(await numberingStatus(prismaFalso()), {
    seeded: false,
    seededAt: null,
    seedValue: null
  });

  const semeada = await numberingStatus(
    prismaFalso({ seededAt: new Date('2026-08-03'), seedValue: 4435 })
  );
  assert.equal(semeada.seeded, true);
  assert.equal(semeada.seedValue, 4435);
});
