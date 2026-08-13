import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorshipFilter,
  canArchive,
  canDownloadDocument,
  canFinalize,
  canRead,
  canViewValues,
  canWrite,
  isEstimator,
  isManager,
  serializeForUser,
  serializeListForUser,
  stripValues
} from '../src/lib/comercial/access.js';

/**
 * Matriz de permissão do módulo Comercial — 3 papéis × 2 entidades.
 *
 * Oráculo: specs/009-modulo-comercial/contracts/api-contracts.md.
 *
 * O caso que mais importa e que passa despercebido em revisão é o do
 * "vendedor A pedindo a listagem enquanto existe registro do vendedor B".
 * Se a filtragem estiver só na rota de item e não no índice, é o único
 * teste que pega — a tela do vendedor continua funcionando, só mostra demais.
 */

// `serializeModuleRoles` aceita `moduleRoles` como lista de strings públicas
// ou de linhas do Prisma (`{ role: 'COMERCIAL_MANAGER' }`). Aqui usamos as
// duas formas de propósito: se qualquer uma parar de funcionar, este teste
// quebra junto — que é o desejado.
function usuario(id, ...papeis) {
  return { id, moduleRoles: papeis };
}

const gestor = usuario('u-gestor', 'comercial:manager');
const vendedorA = usuario('u-vend-a', 'comercial:seller');
const vendedorB = { id: 'u-vend-b', moduleRoles: [{ role: 'COMERCIAL_SELLER' }] };
const consulta = usuario('u-consulta', 'comercial:viewer');
const forasteiro = usuario('u-fora');

const registroDeA = { id: 'r1', createdByUserId: 'u-vend-a', totalValue: '1000.00' };
const registroDeB = { id: 'r2', createdByUserId: 'u-vend-b', totalValue: '2000.00' };

test('papéis são reconhecidos', () => {
  assert.equal(isManager(gestor), true);
  assert.equal(isManager(vendedorA), false);
  assert.equal(isEstimator(vendedorA), true);
  assert.equal(isEstimator(consulta), false, 'consulta não é orçamentista');
  assert.equal(isEstimator(forasteiro), false);
});

test('leitura: gestor alcança tudo, vendedor só o que é seu', () => {
  assert.equal(canRead(gestor, registroDeA), true);
  assert.equal(canRead(gestor, registroDeB), true);

  assert.equal(canRead(vendedorA, registroDeA), true);
  assert.equal(canRead(vendedorA, registroDeB), false, 'vendedor A não lê registro de B');

  assert.equal(canRead(consulta, registroDeA), false);
  assert.equal(canRead(forasteiro, registroDeA), false);

  // O vendedor B vem no formato de linha do Prisma (`{ role: 'COMERCIAL_SELLER' }`),
  // e a regra tem de valer igual. É simétrico: cada um lê o seu.
  assert.equal(canRead(vendedorB, registroDeB), true);
  assert.equal(canRead(vendedorB, registroDeA), false);
});

test('escrita: a autoria vale para as duas entidades', () => {
  assert.equal(canWrite(gestor, registroDeB), true, 'gestor escreve em qualquer um');
  assert.equal(canWrite(vendedorA, registroDeA), true);
  assert.equal(canWrite(vendedorA, registroDeB), false);
  assert.equal(canWrite(consulta, registroDeA), false, 'consulta é somente leitura');
});

test('finalização: o autor finaliza a sua, o gestor finaliza qualquer uma', () => {
  assert.equal(canFinalize(vendedorA, registroDeA), true);
  assert.equal(canFinalize(vendedorA, registroDeB), false);
  assert.equal(canFinalize(gestor, registroDeA), true);
  assert.equal(canFinalize(consulta, registroDeA), false);
});

test('arquivar segue a regra de escrita, e não existe exclusão', () => {
  assert.equal(canArchive(vendedorA, registroDeA), true);
  assert.equal(canArchive(vendedorA, registroDeB), false);
  assert.equal(canArchive(gestor, registroDeB), true);
});

// ---------------------------------------------------------------------------
// O CASO CRÍTICO: filtragem na LISTAGEM, não só na rota de item.
// ---------------------------------------------------------------------------

test('listagem: o filtro de autoria restringe o vendedor', () => {
  assert.deepEqual(authorshipFilter(gestor), {}, 'gestor lista tudo');
  assert.deepEqual(
    authorshipFilter(vendedorA),
    { createdByUserId: 'u-vend-a' },
    'vendedor lista só os seus'
  );
});

test('vendedor A não recebe registro do vendedor B pela listagem', () => {
  // Simula o índice aplicando o filtro, que é o que a rota tem de fazer.
  const todos = [registroDeA, registroDeB];
  const filtro = authorshipFilter(vendedorA);

  const visiveis = todos.filter(item =>
    Object.entries(filtro).every(([campo, valor]) => item[campo] === valor)
  );

  assert.deepEqual(
    visiveis.map(item => item.id),
    ['r1'],
    'a listagem vazou registro de outro vendedor'
  );
});

test('o papel de consulta não alcança levantamento por nenhum caminho', () => {
  const filtro = authorshipFilter(consulta);
  const visiveis = [registroDeA, registroDeB].filter(item =>
    Object.entries(filtro).every(([campo, valor]) => item[campo] === valor)
  );
  assert.deepEqual(visiveis, [], 'consulta não pode alcançar levantamento');
});

// ---------------------------------------------------------------------------
// Supressão de valores NA ORIGEM.
// ---------------------------------------------------------------------------

test('consulta não vê valor, custo nem margem', () => {
  assert.equal(canViewValues(gestor), true);
  assert.equal(canViewValues(vendedorA), true);
  assert.equal(canViewValues(consulta), false);
});

test('os campos de valor são removidos do objeto, não escondidos', () => {
  const completo = {
    id: 'p1',
    clientName: 'ACME',
    totalValue: '10000.00',
    totalCost: '7000.00',
    salePrice: '10000.00',
    marginPercent: '15.00',
    commissionBps: 900
  };

  const limpo = stripValues(completo);

  for (const campo of ['totalValue', 'totalCost', 'salePrice', 'marginPercent', 'commissionBps']) {
    assert.ok(!(campo in limpo), `${campo} continua presente no objeto`);
  }
  assert.equal(limpo.clientName, 'ACME', 'os campos não sensíveis permanecem');
  assert.equal(completo.totalValue, '10000.00', 'o objeto original não é mutado');
});

test('serializeForUser aplica a supressão por papel', () => {
  const proposta = { id: 'p1', clientName: 'ACME', totalValue: '10000.00' };

  assert.equal(serializeForUser(gestor, proposta).totalValue, '10000.00');
  assert.equal(serializeForUser(vendedorA, proposta).totalValue, '10000.00');
  assert.ok(
    !('totalValue' in serializeForUser(consulta, proposta)),
    'o valor tem de sumir da resposta, não da tela'
  );
});

test('serializeListForUser limpa a lista inteira', () => {
  const lista = [
    { id: 'p1', totalValue: '1.00' },
    { id: 'p2', totalValue: '2.00' }
  ];
  const paraConsulta = serializeListForUser(consulta, lista);
  assert.equal(paraConsulta.length, 2);
  assert.ok(paraConsulta.every(item => !('totalValue' in item)));
  assert.ok(serializeListForUser(gestor, lista).every(item => 'totalValue' in item));
});

test('a lista da consulta não entrega nem o identificador do PDF comercial', () => {
  const lista = [
    {
      id: 'p1',
      totalValue: '10000.00',
      documents: [
        { id: 'dc', kind: 'COMERCIAL', fileName: 'Comercial.pdf' },
        { id: 'dt', kind: 'TECNICA', fileName: 'Tecnica.pdf' }
      ]
    }
  ];

  const [paraConsulta] = serializeListForUser(consulta, lista);
  assert.deepEqual(paraConsulta.documents, [
    { id: 'dt', kind: 'TECNICA', fileName: 'Tecnica.pdf' }
  ]);
  assert.equal(lista[0].documents.length, 2, 'a serialização não pode mutar o registro original');

  const [paraGestor] = serializeListForUser(gestor, lista);
  assert.equal(paraGestor.documents.length, 2);
});

// ---------------------------------------------------------------------------
// Documentos.
// ---------------------------------------------------------------------------

test('consulta baixa a técnica e NÃO baixa a comercial', () => {
  const tecnica = { id: 'd1', kind: 'TECNICA' };
  const comercial = { id: 'd2', kind: 'COMERCIAL' };

  assert.equal(canDownloadDocument(consulta, tecnica), true);
  assert.equal(
    canDownloadDocument(consulta, comercial),
    false,
    'a proposta comercial traz preços — liberá-la contorna a restrição de valores'
  );

  assert.equal(canDownloadDocument(gestor, comercial), true);
  assert.equal(canDownloadDocument(vendedorA, comercial), true);
});
