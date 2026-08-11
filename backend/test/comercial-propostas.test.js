import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeListForUser } from '../src/lib/comercial/access.js';
import {
  ComercialError,
  archiveProposal,
  calcularTotal,
  createProposal,
  getProposal,
  listProposals,
  numeroBase,
  proximaRevisao,
  updateProposal
} from '../src/lib/comercial/proposals.js';

/**
 * Propostas — camada de negócio (tarefas T051, T052 e T054).
 *
 * Prisma falso pelo mesmo motivo do teste de levantamentos: o que precisa ser
 * provado aqui é regra, não SQL. As quatro que importam:
 *
 *   1. o valor total é o do SERVIDOR, somado dos itens de preço
 *   2. a listagem filtra por autoria — e o papel de CONSULTA é a exceção
 *   3. o vínculo com o levantamento recusa levantamento alheio e código trocado
 *   4. revisar proposta antiga, sem snapshot, é caminho normal — não erro
 */

const gestor = { id: 'u-gestor', name: 'Gestora', moduleRoles: ['comercial:manager'] };
const vendedorA = { id: 'u-vend-a', name: 'Vendedor A', moduleRoles: ['comercial:seller'] };
const vendedorB = { id: 'u-vend-b', name: 'Vendedor B', moduleRoles: ['comercial:seller'] };
const consulta = { id: 'u-consulta', name: 'Consulta', moduleRoles: ['comercial:viewer'] };

const PRECOS = [
  { description: 'Filtragem', unit: 'dia', quantity: '10', value: 'R$ 11.250,00' },
  { description: 'Mobilização', unit: 'vb', quantity: '1', value: 'R$ 3.500,50' }
];

function payload(extra = {}) {
  return { client: 'Cliente', prices: PRECOS, ...extra };
}

function fakePrisma({ propostas = [], levantamentos = [], usuarios = [] } = {}) {
  const store = { propostas: [...propostas], levantamentos: [...levantamentos] };
  let sequencia = store.propostas.length;

  const casa = (item, where) => {
    if (where.createdByUserId && item.createdByUserId !== where.createdByUserId) return false;
    if (where.proposalCode && item.proposalCode !== where.proposalCode) return false;
    if (where.archivedAt === null && item.archivedAt) return false;
    if (where.archivedAt?.not === null && !item.archivedAt) return false;
    return true;
  };

  return {
    store,
    proposal: {
      findUnique: async ({ where }) => store.propostas.find(p => p.id === where.id) || null,
      findMany: async ({ where = {} }) => store.propostas.filter(p => casa(p, where)),
      create: async ({ data }) => {
        const colide = store.propostas.some(
          p =>
            p.proposalCode === data.proposalCode && p.revisionNumber === (data.revisionNumber ?? 0)
        );
        if (colide) {
          const erro = new Error('Unique constraint failed');
          erro.code = 'P2002';
          throw erro;
        }
        const row = {
          id: `p${++sequencia}`,
          status: 'RASCUNHO',
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        };
        store.propostas.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = store.propostas.find(p => p.id === where.id);
        Object.assign(row, data);
        return row;
      }
    },
    costEstimate: {
      findUnique: async ({ where }) =>
        store.levantamentos.find(l => l.id === where.id) || null
    },
    user: {
      findFirst: async ({ where }) => usuarios.find(u => u.id === where.id) || null
    }
  };
}

const dadosBase = {
  proposalCode: '4418',
  revisionNumber: 0,
  clientName: 'Petrobras',
  cnpj: '33.000.167/0001-01',
  contact: 'Fulano',
  email: 'fulano@cliente.com',
  site: 'Macaé',
  payload: payload()
};

// ---------------------------------------------------------------------------
// O valor total é do servidor
// ---------------------------------------------------------------------------

test('o total é somado dos itens de preço, com a máscara de moeda desfeita', () => {
  // "R$ 11.250,00" lido com `Number` daria NaN: ponto é milhar e vírgula é
  // decimal. É a mesma leitura que o gerador do documento usa — de propósito.
  assert.equal(calcularTotal(payload()), 14750.5);
});

test('totalValue enviado pelo cliente é IGNORADO', async () => {
  const prisma = fakePrisma();

  await createProposal(prisma, vendedorA, { ...dadosBase, totalValue: 999999 });

  const gravada = prisma.store.propostas[0];
  assert.equal(Number(gravada.totalValue), 14750.5);
  assert.notEqual(Number(gravada.totalValue), 999999, 'valor forjado entrou no banco');
});

test('hidrojateamento leva a MAIOR das duas tabelas, não a soma', () => {
  // ONSHORE e OFFSHORE são cenários alternativos de execução: o cliente contrata
  // um ou outro. Somar as duas mandaria ao CRM um valor que ninguém vai pagar.
  const total = calcularTotal({
    prices: [
      { value: 'R$ 10.000,00', local: 'ONSHORE' },
      { value: 'R$ 5.000,00', local: 'ONSHORE' },
      { value: 'R$ 20.000,00', local: 'OFFSHORE' }
    ]
  });

  assert.equal(total, 20000);
  assert.notEqual(total, 35000, 'somou as duas tabelas');
});

test('proposta sem itens de preço vale zero, não NaN', () => {
  assert.equal(calcularTotal({}), 0);
  assert.equal(calcularTotal({ prices: [] }), 0);
});

// ---------------------------------------------------------------------------
// Alcance — e a exceção do papel de consulta
// ---------------------------------------------------------------------------

test('a listagem do vendedor A não traz proposta do vendedor B', async () => {
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-vend-a', archivedAt: null },
      { id: 'p2', proposalCode: '4419', revisionNumber: 0, createdByUserId: 'u-vend-b', archivedAt: null }
    ]
  });

  const { items } = await listProposals(prisma, vendedorA);
  assert.deepEqual(items.map(i => i.id), ['p1'], 'a listagem vazou proposta de outro vendedor');

  const doGestor = await listProposals(prisma, gestor);
  assert.equal(doGestor.items.length, 2, 'o gestor alcança as duas');
});

test('o papel de CONSULTA alcança todas as propostas — é a exceção', async () => {
  // Aqui a proposta diverge do levantamento de propósito: a listagem é a
  // superfície inteira do `viewer` (FR-030). Aplicar o filtro de autoria daria
  // a ele uma tela vazia, sem erro e sem nada que denunciasse o engano.
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-vend-a', archivedAt: null },
      { id: 'p2', proposalCode: '4419', revisionNumber: 0, createdByUserId: 'u-vend-b', archivedAt: null }
    ]
  });

  const { items } = await listProposals(prisma, consulta);
  assert.equal(items.length, 2, 'a consulta precisa alcançar todas as propostas');
});

test('a resposta ao papel de consulta NÃO CONTÉM totalValue', () => {
  const items = [{ id: 'p1', proposalCode: '4418', totalValue: 14750.5 }];

  const paraConsulta = serializeListForUser(consulta, items);
  assert.ok(!('totalValue' in paraConsulta[0]), 'o valor foi apenas escondido, não omitido');

  const paraVendedor = serializeListForUser(vendedorA, items);
  assert.equal(paraVendedor[0].totalValue, 14750.5);
});

test('a listagem ordena por número e revisão, não pelo texto do código', async () => {
  // Ordenar o código como texto poria "999" à frente de "4418" no dia em que a
  // numeração passar de quatro dígitos.
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '999', revisionNumber: 0, createdByUserId: 'u-gestor', archivedAt: null },
      { id: 'p2', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-gestor', archivedAt: null },
      { id: 'p3', proposalCode: '4418', revisionNumber: 2, createdByUserId: 'u-gestor', archivedAt: null }
    ]
  });

  const { items } = await listProposals(prisma, gestor);
  assert.deepEqual(items.map(i => i.id), ['p3', 'p2', 'p1']);
});

test('vendedor pedindo proposta de outro autor recebe 403, não 404', async () => {
  const prisma = fakePrisma({
    propostas: [{ id: 'p2', createdByUserId: 'u-vend-b', archivedAt: null }]
  });

  await assert.rejects(
    () => getProposal(prisma, vendedorA, 'p2'),
    error => error.statusCode === 403
  );

  const doDono = await getProposal(prisma, vendedorB, 'p2');
  assert.equal(doDono.id, 'p2');
});

test('proposta inexistente é 404', async () => {
  const prisma = fakePrisma();
  await assert.rejects(
    () => getProposal(prisma, gestor, 'nao-existe'),
    error => error instanceof ComercialError && error.statusCode === 404
  );
});

// ---------------------------------------------------------------------------
// Autoria do consultor de vendas
// ---------------------------------------------------------------------------

test('o nome do vendedor é gravado junto com o id, no momento da emissão', async () => {
  const prisma = fakePrisma();

  await createProposal(prisma, vendedorA, dadosBase);

  const gravada = prisma.store.propostas[0];
  assert.equal(gravada.sellerUserId, 'u-vend-a');
  // Renomear a conta depois não pode reescrever a proposta que já foi ao
  // cliente: o PDF impresso diz um nome, e o sistema tem de dizer o mesmo.
  assert.equal(gravada.sellerName, 'Vendedor A');
  assert.equal(gravada.estimatorName, 'Vendedor A');
});

test('vendedor não emite proposta em nome de outro', async () => {
  const prisma = fakePrisma();

  await assert.rejects(
    () => createProposal(prisma, vendedorA, { ...dadosBase, sellerUserId: 'u-vend-b' }),
    error => error.statusCode === 403
  );
});

test('gestor emite em nome de um vendedor ativo do módulo', async () => {
  const prisma = fakePrisma({
    usuarios: [{ id: 'u-vend-a', name: 'Vendedor A', username: 'vend-a' }]
  });

  await createProposal(prisma, gestor, { ...dadosBase, sellerUserId: 'u-vend-a' });

  const gravada = prisma.store.propostas[0];
  assert.equal(gravada.sellerUserId, 'u-vend-a');
  assert.equal(gravada.sellerName, 'Vendedor A');
  assert.equal(gravada.createdByUserId, 'u-gestor', 'a autoria continua sendo de quem criou');
});

// ---------------------------------------------------------------------------
// Vínculo com o levantamento
// ---------------------------------------------------------------------------

test('a proposta se vincula ao levantamento de mesmo código', async () => {
  const prisma = fakePrisma({
    levantamentos: [{ id: 'e1', proposalCode: '4418', createdByUserId: 'u-vend-a' }]
  });

  await createProposal(prisma, vendedorA, { ...dadosBase, costEstimateId: 'e1' });

  assert.equal(prisma.store.propostas[0].costEstimateId, 'e1');
});

test('não se vincula a levantamento de outro orçamentista', async () => {
  const prisma = fakePrisma({
    levantamentos: [{ id: 'e1', proposalCode: '4418', createdByUserId: 'u-vend-b' }]
  });

  await assert.rejects(
    () => createProposal(prisma, vendedorA, { ...dadosBase, costEstimateId: 'e1' }),
    error => error.statusCode === 403
  );
});

test('não se vincula a levantamento de OUTRA proposta', async () => {
  // O levantamento é quem carimba o código que os dois documentos usam.
  // Divergirem significa que um dos dois aponta para a proposta errada — e o
  // erro só apareceria na planilha de custos da finalização, semanas depois.
  const prisma = fakePrisma({
    levantamentos: [{ id: 'e1', proposalCode: '4400', createdByUserId: 'u-vend-a' }]
  });

  await assert.rejects(
    () => createProposal(prisma, vendedorA, { ...dadosBase, costEstimateId: 'e1' }),
    error => {
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /4400/);
      return true;
    }
  );
});

test('levantamento inexistente recusa com 422, não grava proposta órfã', async () => {
  const prisma = fakePrisma();

  await assert.rejects(
    () => createProposal(prisma, vendedorA, { ...dadosBase, costEstimateId: 'e-fantasma' }),
    error => error.statusCode === 422
  );

  assert.equal(prisma.store.propostas.length, 0);
});

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

test('o código e a revisão não mudam na edição', async () => {
  const prisma = fakePrisma();
  await createProposal(prisma, vendedorA, dadosBase);
  const id = prisma.store.propostas[0].id;

  await updateProposal(prisma, vendedorA, id, {
    proposalCode: '9999',
    revisionNumber: 7,
    clientName: 'Outro cliente'
  });

  const gravada = prisma.store.propostas[0];
  assert.equal(gravada.proposalCode, '4418', 'o código veio da numeração já consumida');
  assert.equal(gravada.revisionNumber, 0);
  assert.equal(gravada.clientName, 'Outro cliente');
});

test('o total é recalculado a cada edição', async () => {
  const prisma = fakePrisma();
  await createProposal(prisma, vendedorA, dadosBase);
  const id = prisma.store.propostas[0].id;

  await updateProposal(prisma, vendedorA, id, {
    payload: payload({ prices: [{ value: 'R$ 1.000,00' }] })
  });

  assert.equal(Number(prisma.store.propostas[0].totalValue), 1000);
});

test('proposta finalizada não aceita edição — o caminho é revisar', async () => {
  const prisma = fakePrisma({
    propostas: [
      {
        id: 'p1',
        proposalCode: '4418',
        revisionNumber: 0,
        createdByUserId: 'u-vend-a',
        status: 'FINALIZADA',
        archivedAt: null,
        payload: payload()
      }
    ]
  });

  await assert.rejects(
    () => updateProposal(prisma, vendedorA, 'p1', { clientName: 'Novo' }),
    error => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('proposta arquivada não aceita edição', async () => {
  const prisma = fakePrisma({
    propostas: [
      {
        id: 'p1',
        createdByUserId: 'u-vend-a',
        status: 'RASCUNHO',
        archivedAt: new Date(),
        payload: payload()
      }
    ]
  });

  await assert.rejects(
    () => updateProposal(prisma, vendedorA, 'p1', { clientName: 'Novo' }),
    error => error.statusCode === 409
  );
});

test('vendedor não escreve em proposta de outro autor', async () => {
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', createdByUserId: 'u-vend-b', status: 'RASCUNHO', archivedAt: null, payload: payload() }
    ]
  });

  await assert.rejects(
    () => updateProposal(prisma, vendedorA, 'p1', { clientName: 'Novo' }),
    error => error.statusCode === 403
  );
});

test('a mesma revisão da mesma proposta não é criada duas vezes', async () => {
  const prisma = fakePrisma();
  await createProposal(prisma, vendedorA, dadosBase);

  await assert.rejects(
    () => createProposal(prisma, vendedorA, dadosBase),
    error => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /4418/);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// Arquivamento — não existe exclusão
// ---------------------------------------------------------------------------

test('a listagem padrão esconde arquivadas, e o filtro explícito as traz', async () => {
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-vend-a', archivedAt: null },
      { id: 'p2', proposalCode: '4419', revisionNumber: 0, createdByUserId: 'u-vend-a', archivedAt: new Date() }
    ]
  });

  const ativas = await listProposals(prisma, vendedorA);
  assert.deepEqual(ativas.items.map(i => i.id), ['p1']);

  const arquivadas = await listProposals(prisma, vendedorA, { arquivados: true });
  assert.deepEqual(arquivadas.items.map(i => i.id), ['p2']);
});

test('arquivar registra quem arquivou, e desarquivar limpa os dois campos', async () => {
  const prisma = fakePrisma({
    propostas: [{ id: 'p1', createdByUserId: 'u-vend-a', archivedAt: null }]
  });

  await archiveProposal(prisma, vendedorA, 'p1', { archive: true });
  assert.ok(prisma.store.propostas[0].archivedAt);
  assert.equal(prisma.store.propostas[0].archivedByUserId, 'u-vend-a');

  await archiveProposal(prisma, vendedorA, 'p1', { archive: false });
  assert.equal(prisma.store.propostas[0].archivedAt, null);
  assert.equal(prisma.store.propostas[0].archivedByUserId, null);
});

// ---------------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------------

test('o número base sai do código da proposta', () => {
  assert.equal(numeroBase('4418'), 4418);
  assert.equal(numeroBase('4418 Rev 2'), 4418);
  assert.equal(numeroBase(''), 0);
  assert.equal(numeroBase(null), 0);
});

test('a próxima revisão é a maior existente mais um', async () => {
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-vend-a', payload: payload(), updatedAt: new Date(1) },
      { id: 'p2', proposalCode: '4418', revisionNumber: 2, createdByUserId: 'u-vend-a', payload: payload(), updatedAt: new Date(2) }
    ]
  });

  const revisao = await proximaRevisao(prisma, vendedorA, '4418');

  assert.equal(revisao.baseNumber, 4418);
  assert.equal(revisao.nextRevision, 3);
  assert.equal(revisao.snapshotAvailable, true);
  assert.equal(revisao.snapshot.client, 'Cliente');
});

test('proposta antiga SEM snapshot não falha — é caminho normal', async () => {
  // FR-065. Tratar a ausência de snapshot como erro tornaria impossível revisar
  // qualquer proposta gravada antes de o snapshot existir.
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4400', revisionNumber: 0, createdByUserId: 'u-vend-a', payload: {}, updatedAt: new Date() }
    ]
  });

  const revisao = await proximaRevisao(prisma, vendedorA, '4400');

  assert.equal(revisao.snapshotAvailable, false);
  assert.deepEqual(revisao.snapshot, {});
  assert.equal(revisao.nextRevision, 1);
});

test('o snapshot vem da revisão mais nova que tiver conteúdo', async () => {
  const prisma = fakePrisma({
    propostas: [
      { id: 'p1', proposalCode: '4418', revisionNumber: 0, createdByUserId: 'u-vend-a', payload: payload({ client: 'Antigo' }), updatedAt: new Date(1) },
      { id: 'p2', proposalCode: '4418', revisionNumber: 1, createdByUserId: 'u-vend-a', payload: {}, updatedAt: new Date(2) }
    ]
  });

  const revisao = await proximaRevisao(prisma, vendedorA, '4418');

  assert.equal(revisao.snapshotAvailable, true);
  assert.equal(revisao.snapshot.client, 'Antigo', 'devia ter caído para a revisão anterior');
});

test('revisão de proposta que não existe é 404', async () => {
  const prisma = fakePrisma();
  await assert.rejects(
    () => proximaRevisao(prisma, vendedorA, '9999'),
    error => error.statusCode === 404
  );
});
