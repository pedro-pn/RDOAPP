import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.COMERCIAL_DIR = await mkdtemp(path.join(tmpdir(), 'comercial-final-'));
// `fake` responde como se o CRM tivesse aceitado, sem tocar na rede. Sem ele não
// haveria como testar a finalização: o Nectar não tem sandbox, e o modo `real`
// escreveria no CRM da empresa.
process.env.NECTAR_MODE = 'fake';
process.env.NECTAR_PIPELINE_IDS = '100,200';

const { finalizarProposta, exigirNaoFinalizada } = await import('../src/lib/comercial/jobs.js');
const { documentosAtuais } = await import('../src/lib/comercial/documentos.js');

/**
 * Finalização da proposta (T076, T077, T078, T079a, T080).
 *
 * O que precisa ser provado aqui é a ORDEM e o CONTRATO DE FALHA:
 *
 *   1. a exclusividade é conferida ANTES de gerar qualquer coisa (T079a)
 *   2. os PDFs são gravados ANTES de qualquer integração (FR-033)
 *   3. integração que falha DEPOIS disso responde erro **com os documentos**
 *      (FR-034) — o trabalho não se perde
 */

const raiz = process.env.COMERCIAL_DIR;

test.after(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const vendedorA = { id: 'u-vend-a', name: 'Vendedor A', moduleRoles: ['comercial:seller'] };
const vendedorB = { id: 'u-vend-b', name: 'Vendedor B', moduleRoles: ['comercial:seller'] };
const gestor = { id: 'u-gestor', name: 'Gestora', moduleRoles: ['comercial:manager'] };
const consulta = { id: 'u-consulta', name: 'Consulta', moduleRoles: ['comercial:viewer'] };

function propostaBase(extra = {}) {
  return {
    id: 'p1',
    proposalCode: '4418',
    revisionNumber: 0,
    status: 'RASCUNHO',
    archivedAt: null,
    createdByUserId: 'u-vend-a',
    sellerName: 'Vendedor A',
    estimatorName: 'Orçamentista',
    clientName: 'Petrobras',
    contact: 'Fulano',
    email: 'fulano@cliente.com',
    site: 'Macaé',
    totalValue: 14750.5,
    finalizedAt: null,
    finalizedByUserId: null,
    nectarStatus: 'PENDENTE',
    nectarOpportunityId: null,
    nectarPipelineId: null,
    nectarPipelineName: null,
    integrationError: null,
    payload: { title: 'Filtragem', companyId: '9', contactId: '7', prices: [] },
    ...extra
  };
}

function fakePrisma(propostas = []) {
  const store = { propostas: [...propostas], documentos: [], auditoria: [], atualizacoes: [] };
  let sequencia = 0;

  const proposalDocument = {
    create: ({ data }) => {
      const row = { id: `d${++sequencia}`, createdAt: new Date(Date.now() + sequencia), ...data };
      store.documentos.push(row);
      return Promise.resolve(row);
    },
    findMany: async ({ where, orderBy }) => {
      const items = store.documentos.filter(d => d.proposalId === where.proposalId);
      if (orderBy?.createdAt === 'desc') items.sort((a, b) => b.createdAt - a.createdAt);
      return items;
    },
    findUnique: async ({ where }) => store.documentos.find(d => d.id === where.id) || null
  };

  return {
    store,
    proposal: {
      // Devolve CÓPIA, como o Prisma de verdade. Compartilhar a referência com o
      // store faria uma escrita posterior alterar o objeto já carregado — e foi
      // exatamente assim que o retorno ao estado anterior passou despercebido.
      findUnique: async ({ where }) => {
        const row = store.propostas.find(p => p.id === where.id);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }) => {
        const row = store.propostas.find(p => p.id === where.id);
        store.atualizacoes.push({ ...data });
        Object.assign(row, data);
        return row;
      }
    },
    proposalDocument,
    proposalAuditLog: {
      create: async ({ data }) => {
        store.auditoria.push(data);
        return data;
      }
    },
    $transaction: async operacoes => Promise.all(operacoes)
  };
}

const gerarPdf = async (dados, tipo) => Buffer.from(`%PDF-${tipo}-${dados.proposalCode}`);

// ---------------------------------------------------------------------------
// Exclusividade — antes de gerar qualquer coisa
// ---------------------------------------------------------------------------

test('proposta já finalizada é 409, e a recusa diz QUANDO', () => {
  // "Já finalizada" sozinho manda a pessoa procurar quem foi — e normalmente é o
  // colega ao lado.
  const quando = new Date('2026-08-10T14:30:00Z');

  assert.throws(
    () => exigirNaoFinalizada(propostaBase({ status: 'FINALIZADA', finalizedAt: quando })),
    error => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /2026|10\/08/);
      assert.equal(error.finalizedAt, quando);
      return true;
    }
  );
});

test('proposta em finalização é 409 — dois cliques não geram dois pares', async () => {
  const prisma = fakePrisma([propostaBase({ status: 'FINALIZANDO' })]);

  await assert.rejects(
    () => finalizarProposta(prisma, vendedorA, 'p1', { pipelineId: '100', gerarPdf }),
    error => error.statusCode === 409
  );

  assert.equal(prisma.store.documentos.length, 0, 'gerou documento de uma segunda finalização');
});

test('a exclusividade é conferida ANTES de gerar', async () => {
  const prisma = fakePrisma([propostaBase({ status: 'FINALIZADA', finalizedAt: new Date() })]);
  let gerou = false;

  await assert.rejects(() =>
    finalizarProposta(prisma, vendedorA, 'p1', {
      pipelineId: '100',
      gerarPdf: async () => {
        gerou = true;
        return Buffer.from('%PDF');
      }
    })
  );

  assert.equal(gerou, false, 'gerou PDF antes de conferir se podia finalizar');
});

test('o estado vira FINALIZANDO antes da geração', async () => {
  const prisma = fakePrisma([propostaBase()]);
  const estadosDurante = [];

  await finalizarProposta(prisma, vendedorA, 'p1', {
    pipelineId: '100',
    gerarPdf: async (dados, tipo) => {
      estadosDurante.push(prisma.store.propostas[0].status);
      return Buffer.from(`%PDF-${tipo}`);
    }
  });

  // É o que faz o segundo clique encontrar FINALIZANDO em vez de RASCUNHO.
  assert.deepEqual(estadosDurante, ['FINALIZANDO', 'FINALIZANDO']);
});

// ---------------------------------------------------------------------------
// Permissão (T078)
// ---------------------------------------------------------------------------

test('o autor finaliza a sua e o gestor finaliza qualquer uma', async () => {
  const doAutor = fakePrisma([propostaBase()]);
  assert.equal((await finalizarProposta(doAutor, vendedorA, 'p1', { pipelineId: '100', gerarPdf })).ok, true);

  const doGestor = fakePrisma([propostaBase()]);
  assert.equal((await finalizarProposta(doGestor, gestor, 'p1', { pipelineId: '100', gerarPdf })).ok, true);
});

test('vendedor não finaliza proposta de outro autor', async () => {
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(
    () => finalizarProposta(prisma, vendedorB, 'p1', { pipelineId: '100', gerarPdf }),
    error => error.statusCode === 403
  );

  assert.equal(prisma.store.documentos.length, 0);
});

test('o papel de consulta nunca finaliza', async () => {
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(
    () => finalizarProposta(prisma, consulta, 'p1', { pipelineId: '100', gerarPdf }),
    error => error.statusCode === 403
  );
});

test('proposta arquivada não finaliza', async () => {
  const prisma = fakePrisma([propostaBase({ archivedAt: new Date() })]);

  await assert.rejects(
    () => finalizarProposta(prisma, vendedorA, 'p1', { pipelineId: '100', gerarPdf }),
    error => error.statusCode === 409
  );
});

// ---------------------------------------------------------------------------
// O caminho feliz
// ---------------------------------------------------------------------------

test('finaliza: dois documentos gravados, card no CRM e estado FINALIZADA', async () => {
  const prisma = fakePrisma([propostaBase()]);

  const resultado = await finalizarProposta(prisma, vendedorA, 'p1', {
    pipelineId: '100',
    gerarPdf
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.documentos.length, 2);
  assert.equal(prisma.store.documentos.length, 2);

  const proposta = prisma.store.propostas[0];
  assert.equal(proposta.status, 'FINALIZADA');
  assert.equal(proposta.nectarStatus, 'SUCESSO');
  assert.equal(proposta.finalizedByUserId, 'u-vend-a');
  assert.ok(proposta.finalizedAt);
  assert.equal(proposta.nectarOpportunityId, 'fake-op-4418');
  assert.equal(proposta.nectarPipelineId, '100');
});

test('o funil fica gravado pelo NOME do momento da emissão', async () => {
  // Renomear o funil no CRM depois não pode reescrever o que a proposta
  // registrou — mesma regra do sellerName.
  const prisma = fakePrisma([propostaBase()]);
  await finalizarProposta(prisma, vendedorA, 'p1', { pipelineId: '200', gerarPdf });

  assert.equal(prisma.store.propostas[0].nectarPipelineName, 'Funil de teste 200');
});

test('as duas ações irreversíveis viram auditoria', async () => {
  const prisma = fakePrisma([propostaBase()]);
  await finalizarProposta(prisma, vendedorA, 'p1', { pipelineId: '100', gerarPdf });

  assert.deepEqual(
    prisma.store.auditoria.map(item => item.action),
    ['FINALIZADA', 'INTEGRACAO_ENVIADA']
  );
  assert.equal(prisma.store.auditoria[0].actorUserId, 'u-vend-a');
});

// ---------------------------------------------------------------------------
// O CONTRATO DE FALHA (FR-034) — o teste que a T085 pede
// ---------------------------------------------------------------------------

test('O CASO CRÍTICO: integração falha DEPOIS dos PDFs prontos, e eles continuam baixáveis', async () => {
  // Funil fora da lista branca: a integração recusa, mas os dois documentos já
  // foram gerados e gravados. O trabalho não pode se perder por causa disso.
  const prisma = fakePrisma([propostaBase()]);

  const resultado = await finalizarProposta(prisma, vendedorA, 'p1', {
    pipelineId: '999',
    gerarPdf
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.documentos.length, 2, 'os documentos precisam vir na resposta de erro');
  assert.equal(prisma.store.documentos.length, 2, 'e precisam estar gravados');

  const atuais = await documentosAtuais(prisma, 'p1');
  assert.equal(atuais.length, 2, 'e precisam continuar baixáveis');

  const proposta = prisma.store.propostas[0];
  assert.equal(proposta.status, 'FALHA_INTEGRACAO');
  assert.equal(proposta.nectarStatus, 'ERRO');
  assert.match(proposta.integrationError, /autorizada/i);
  assert.equal(proposta.finalizedAt, null, 'não finalizou de verdade');
});

test('falha de integração é registrada na auditoria, com o motivo', async () => {
  // "Por que esta proposta não chegou ao CRM" é a pergunta que se faz semanas
  // depois, quando o recado da tela já sumiu.
  const prisma = fakePrisma([propostaBase()]);
  await finalizarProposta(prisma, vendedorA, 'p1', { pipelineId: '999', gerarPdf });

  const falha = prisma.store.auditoria.find(item => item.action === 'INTEGRACAO_FALHOU');
  assert.ok(falha, 'a falha precisa deixar rastro');
  assert.match(falha.detail.erro, /autorizada/i);
});

test('FALHA_INTEGRACAO permite tentar de novo — não é beco sem saída', async () => {
  const prisma = fakePrisma([propostaBase({ status: 'FALHA_INTEGRACAO' })]);

  const resultado = await finalizarProposta(prisma, vendedorA, 'p1', {
    pipelineId: '100',
    gerarPdf
  });

  assert.equal(resultado.ok, true);
  assert.equal(prisma.store.propostas[0].status, 'FINALIZADA');
});

test('geração que falha devolve a proposta ao estado anterior', async () => {
  // Sem isso ela fica presa em FINALIZANDO e ninguém consegue tentar de novo.
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(() =>
    finalizarProposta(prisma, vendedorA, 'p1', {
      pipelineId: '100',
      gerarPdf: async () => Buffer.alloc(0)
    })
  );

  assert.equal(prisma.store.propostas[0].status, 'RASCUNHO');
});

// ---------------------------------------------------------------------------
// Revisão reaproveita o card (FR-066)
// ---------------------------------------------------------------------------

test('havendo card salvo, a finalização REUTILIZA em vez de abrir outro', async () => {
  const prisma = fakePrisma([
    propostaBase({ status: 'FALHA_INTEGRACAO', nectarOpportunityId: 'op-existente' })
  ]);

  const resultado = await finalizarProposta(prisma, vendedorA, 'p1', {
    pipelineId: '100',
    gerarPdf
  });

  assert.equal(resultado.integracao.opportunityId, 'op-existente');
  assert.equal(prisma.store.propostas[0].nectarOpportunityId, 'op-existente');
});
