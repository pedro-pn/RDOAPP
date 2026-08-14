import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import {
  SCOPE_LIMITS,
  SCOPE_PHOTO_LIMITS,
  makeComercialSchemas,
  matchesImageSignature
} from '../../shared/schemas/comercial.js';

/**
 * Contrato Zod do módulo Comercial (tarefa T022).
 *
 * O padrão de módulo exige contrato validado para campo `Json`. Sem ele, o
 * `payload` do levantamento vira depósito sem forma e ninguém descobre que a
 * estrutura mudou até o cálculo sair errado.
 */

const schemas = makeComercialSchemas(z);

test('os limites do escopo são os da referência congelada', () => {
  // Vêm de app/scope-content.ts:37-41. Não são escolha nossa — são paridade.
  assert.deepEqual(SCOPE_LIMITS, {
    photos: 8,
    tables: 8,
    tableColumns: 6,
    tableRows: 40,
    tableCellCharacters: 300,
    captionCharacters: 240
  });
});

test('os limites do upload são os da referência', () => {
  assert.deepEqual(SCOPE_PHOTO_LIMITS.allowedTypes, [
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  assert.equal(SCOPE_PHOTO_LIMITS.maxBytes, 1_500_000);
  assert.equal(SCOPE_PHOTO_LIMITS.maxRequestBytes, 2_000_000);
  assert.equal(SCOPE_PHOTO_LIMITS.maxOriginalBytes, 10_000_000);
  assert.equal(SCOPE_PHOTO_LIMITS.maxEdgePixels, 1600);
});

test('as 5 seções e as 7 etapas estão na ordem da referência', () => {
  assert.deepEqual(
    schemas.SECTIONS.map(section => section.value),
    ['premises', 'labor', 'inputs', 'logistics', 'summary']
  );
  assert.deepEqual(schemas.STEPS, [
    'Cliente',
    'Escopo',
    'Responsabilidades',
    'Prazos',
    'Técnica',
    'Comercial',
    'Revisão'
  ]);
});

test('o payload do levantamento aceita estrutura desconhecida', () => {
  // De propósito: a estrutura interna tem ~40 coleções aninhadas e quem a
  // normaliza é `normalizeCostEstimatePayload` do cost-model. Replicá-la aqui
  // criaria a segunda verdade que este arquivo existe para evitar.
  const resultado = schemas.costEstimatePayload.safeParse({
    schemaVersion: 2,
    laborContexts: [{ qualquer: 'coisa' }]
  });
  assert.equal(resultado.success, true);
});

test('a criação de levantamento NÃO aceita totais do cliente', () => {
  const entrada = {
    proposalCode: '4418',
    title: 'Limpeza química',
    mode: 'NOVA',
    payload: { schemaVersion: 2 },
    totalCost: '1,00',
    salePrice: '999999,00',
    marginPercent: '99,00'
  };

  const parsed = schemas.costEstimateCreate.parse(entrada);

  // Os totais são recalculados no servidor com `calculateEstimate`. Aceitá-los
  // do cliente permitiria forjar margem — e margem forjada vira proposta com
  // preço errado que passa em toda validação.
  assert.ok(!('totalCost' in parsed), 'totalCost não pode entrar pelo corpo');
  assert.ok(!('salePrice' in parsed), 'salePrice não pode entrar pelo corpo');
  assert.ok(!('marginPercent' in parsed), 'marginPercent não pode entrar pelo corpo');
});

test('levantamento aceita rascunho explícito e mantém SALVO como padrão compatível', () => {
  const entrada = {
    proposalCode: '4418',
    title: 'Levantamento',
    mode: 'NOVA',
    payload: { schemaVersion: 2 }
  };

  assert.equal(schemas.costEstimateCreate.parse(entrada).status, 'SALVO');
  assert.equal(
    schemas.costEstimateCreate.parse({ ...entrada, status: 'RASCUNHO' }).status,
    'RASCUNHO'
  );
  assert.equal(
    schemas.costEstimateCreate.safeParse({ ...entrada, status: 'QUALQUER' }).success,
    false
  );
});

test('os dois PUTs exigem a versão carregada e aceitam sobrescrita confirmada', () => {
  const esperado = '2026-08-13T12:00:00.000Z';
  assert.equal(schemas.proposalUpdate.safeParse({ clientName: 'X' }).success, false);
  assert.equal(
    schemas.proposalUpdate.safeParse({
      clientName: 'X',
      expectedUpdatedAt: esperado,
      forceOverwrite: true
    }).success,
    true
  );

  const levantamento = {
    proposalCode: '4418',
    title: 'Levantamento',
    payload: { schemaVersion: 2 },
    expectedUpdatedAt: esperado
  };
  assert.equal(schemas.costEstimateUpdate.safeParse(levantamento).success, true);
  assert.equal(
    schemas.costEstimateUpdate.safeParse({ ...levantamento, expectedUpdatedAt: 'ontem' }).success,
    false
  );
});

test('os blocos de conteúdo respeitam os limites de foto e tabela', () => {
  const foto = index => ({
    id: `f${index}`,
    type: 'photo',
    assetId: `a${index}`,
    caption: '',
    fileName: 'foto.jpg'
  });

  const oito = Array.from({ length: 8 }, (_, index) => foto(index));
  assert.equal(schemas.scopeContentBlocks.safeParse(oito).success, true);

  const nove = Array.from({ length: 9 }, (_, index) => foto(index));
  const excedido = schemas.scopeContentBlocks.safeParse(nove);
  assert.equal(excedido.success, false, 'a nona foto tem de ser recusada');
  assert.match(
    JSON.stringify(excedido.error.issues),
    /até 8 fotos/,
    'a mensagem precisa nomear o limite'
  );
});

test('a tabela do escopo recusa mais colunas do que a referência aceita', () => {
  const tabela = colunas => [
    {
      id: 't1',
      type: 'table',
      title: 'Tabela',
      columns: Array.from({ length: colunas }, (_, i) => `Coluna ${i + 1}`),
      rows: []
    }
  ];

  assert.equal(schemas.scopeContentBlocks.safeParse(tabela(6)).success, true);
  assert.equal(schemas.scopeContentBlocks.safeParse(tabela(7)).success, false);
});

// ---------------------------------------------------------------------------
// Assinatura de bytes — confiar no Content-Type é confiar em quem envia.
// ---------------------------------------------------------------------------

test('a assinatura de bytes reconhece JPEG, PNG e WebP', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
  ]);

  assert.equal(matchesImageSignature(jpeg, 'image/jpeg'), true);
  assert.equal(matchesImageSignature(png, 'image/png'), true);
  assert.equal(matchesImageSignature(webp, 'image/webp'), true);
});

test('um arquivo renomeado para .jpg é recusado pelo conteúdo', () => {
  // O caso real: qualquer arquivo renomeado chega com Content-Type image/jpeg.
  const texto = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // cabeçalho de executável
  assert.equal(
    matchesImageSignature(texto, 'image/jpeg'),
    false,
    'a recusa tem de ser pelo conteúdo, não pelo nome'
  );
});

test('um RIFF que não é WebP é recusado', () => {
  // "RIFF" sozinho também é áudio WAV e vídeo AVI. Sem checar "WEBP" nos
  // bytes 8..11, qualquer um deles passaria.
  const wav = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45
  ]);
  assert.equal(matchesImageSignature(wav, 'image/webp'), false);
});

test('tipo não declarado é sempre recusado', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
  assert.equal(matchesImageSignature(jpeg, 'image/gif'), false);
  assert.equal(matchesImageSignature(jpeg, 'application/pdf'), false);
});
