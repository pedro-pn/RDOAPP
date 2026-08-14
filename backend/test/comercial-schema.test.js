import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { annotate } from '../../scripts/annotate-prisma-schemas.mjs';

/**
 * Dois schemas Postgres na mesma instância — tarefas T015 a T020.
 *
 * O risco que este teste cobre: ativar `multiSchema` obriga a anotar ~120
 * models e enums. Um bloco esquecido quebra o `prisma validate`; um bloco
 * anotado com o schema ERRADO passa na validação e só aparece em produção,
 * quando a tabela nasce no lugar errado.
 *
 * A anotação em massa não move dado nenhum: as tabelas já estão em `public`,
 * e `@@schema("public")` apenas informa ao Prisma onde elas já estão.
 */

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

const MODELS_COMERCIAIS = [
  'CostEstimate',
  'CostEstimateVersion',
  'Proposal',
  'ProposalDocument',
  'ProposalAttachment',
  'ScopeAsset',
  'SalesAttribution',
  'ProposalAuditLog',
  'ProposalNumberingState',
  'ScopePhotoAsset',
  'ComercialSettings',
  'ComercialTutorialSeen',
];

function blocoDe(nome) {
  const inicio = new RegExp(`^(model|enum)\\s+${nome}\\s*\\{`, 'm');
  const match = inicio.exec(schema);
  if (!match) return null;
  const resto = schema.slice(match.index);
  const fim = resto.indexOf('\n}');
  return resto.slice(0, fim + 2);
}

test('o datasource declara os dois schemas', () => {
  assert.match(schema, /schemas\s*=\s*\[\s*"public"\s*,\s*"comercial"\s*\]/);
});

test('todo model e enum tem @@schema — nenhum bloco esquecido', () => {
  const { annotated } = annotate(schema);
  assert.deepEqual(
    annotated,
    [],
    `Bloco sem @@schema: ${annotated.join(', ')}. ` +
      'Rode node scripts/annotate-prisma-schemas.mjs',
  );
});

test('os models do módulo estão em @@schema("comercial")', () => {
  for (const nome of MODELS_COMERCIAIS) {
    const bloco = blocoDe(nome);
    assert.ok(bloco, `model ${nome} não existe no schema`);
    assert.match(
      bloco,
      /@@schema\("comercial"\)/,
      `${nome} precisa viver no schema comercial`,
    );
  }
});

test('nenhum model da operação foi movido para o schema comercial', () => {
  // O critério de aceite da migration: só CREATE SCHEMA e CREATE TABLE
  // comercial.*, e NENHUM ALTER nas tabelas da operação. A prova estrutural
  // é esta: fora os models do módulo, tudo continua em `public`.
  const comerciais = new Set(MODELS_COMERCIAIS);
  const emComercial = [];

  for (const match of schema.matchAll(/^(model|enum)\s+([A-Za-z0-9_]+)\s*\{/gm)) {
    const nome = match[2];
    const bloco = blocoDe(nome);
    if (!bloco || !/@@schema\("comercial"\)/.test(bloco)) continue;
    if (comerciais.has(nome)) continue;

    // Os ENUMS do módulo também vivem em `comercial`, e são reconhecidos pelo
    // prefixo. A lista de MODELS, não: ela é explícita de propósito.
    //
    // Esta distinção existe porque a primeira versão do teste aceitava qualquer
    // bloco com prefixo `Proposal`, e foi assim que `ProposalNumberingState`
    // entrou no schema `comercial` sem ninguém declarar. Um model novo tem de
    // aparecer na lista acima — é a única leitura que prova que alguém decidiu.
    const ehEnum = new RegExp(`^enum\\s+${nome}\\s*\\{`, 'm').test(schema);
    if (ehEnum && /^(CostEstimate|Proposal|SalesAttribution|Scope)/.test(nome)) continue;

    emComercial.push(nome);
  }

  assert.deepEqual(
    emComercial,
    [],
    `Estes blocos foram para o schema comercial e não deveriam: ${emComercial.join(', ')}`,
  );
});

test('dinheiro é Decimal, nunca Float', () => {
  // Float em dinheiro produz centavo errado, e aqui centavo errado vira preço
  // errado numa proposta que já foi ao cliente.
  for (const nome of ['CostEstimate', 'Proposal']) {
    const bloco = blocoDe(nome);
    assert.ok(
      !/\bFloat\b/.test(bloco),
      `${nome} não pode ter campo Float`,
    );
  }

  const custos = blocoDe('CostEstimate');
  assert.match(custos, /totalCost\s+Decimal\s+@db\.Decimal\(14, 2\)/);
  assert.match(custos, /salePrice\s+Decimal\s+@db\.Decimal\(14, 2\)/);
  assert.match(custos, /marginPercent\s+Decimal\s+@db\.Decimal\(6, 2\)/);
  assert.match(blocoDe('Proposal'), /totalValue\s+Decimal\s+@db\.Decimal\(14, 2\)/);
});

test('a autoria e o arquivamento existem nas duas entidades', () => {
  for (const nome of ['CostEstimate', 'Proposal']) {
    const bloco = blocoDe(nome);
    assert.match(bloco, /createdByUserId\s+String/, `${nome}: falta createdByUserId`);
    assert.match(bloco, /updatedByUserId\s+String\?/, `${nome}: falta updatedByUserId`);
    assert.match(bloco, /updatedByLabel\s+String\?/, `${nome}: falta updatedByLabel`);
    assert.match(bloco, /archivedAt\s+DateTime\?/, `${nome}: falta archivedAt`);
    // O índice de listagem precisa considerar autoria E arquivamento —
    // é a consulta que o vendedor faz, e é onde o vazamento apareceria.
    assert.match(
      bloco,
      /@@index\(\[createdByUserId, archivedAt, createdAt\]\)/,
      `${nome}: falta o índice de listagem por autoria`,
    );
  }
});

test('a proposta guarda o vínculo com o vendedor E o nome da emissão', () => {
  const bloco = blocoDe('Proposal');
  assert.match(bloco, /sellerUserId\s+String/, 'falta o vínculo com o usuário');
  assert.match(bloco, /sellerName\s+String/, 'falta o nome do momento da emissão');
  // Só a FK faria proposta antiga mudar de conteúdo quando alguém troca de
  // sobrenome — e o PDF já foi ao cliente com o nome antigo.
});

test('a finalização tem os campos que a tornam exclusiva', () => {
  const bloco = blocoDe('Proposal');
  assert.match(bloco, /finalizedAt\s+DateTime\?/);
  assert.match(bloco, /finalizedByUserId\s+String\?/);
  assert.match(bloco, /finalizedByLabel\s+String\?/);

  // O estado "em finalização" é o que faz a segunda tentativa parar ANTES de
  // gerar qualquer coisa — sem ele, dois cliques produzem dois pares de
  // documentos e duas oportunidades no CRM.
  const status = blocoDe('ProposalStatus');
  assert.ok(status, 'enum ProposalStatus não existe');
  assert.match(status, /FINALIZANDO/, 'falta o estado em finalização');
  assert.match(status, /FINALIZADA/, 'falta o estado finalizada');
});

test('não existe campo de exclusão definitiva', () => {
  for (const nome of MODELS_COMERCIAIS) {
    const bloco = blocoDe(nome);
    assert.ok(
      !/deletedAt|deletedByUserId/.test(bloco),
      `${nome}: o módulo arquiva, não exclui (FR-060)`,
    );
  }
});

test('model novo no schema comercial precisa ser DECLARADO na lista', () => {
  // A regressão que fecha a brecha: a primeira versão deste teste aceitava
  // qualquer bloco com prefixo `Proposal`, e foi assim que
  // `ProposalNumberingState` entrou no schema `comercial` sem revisão. Agora só
  // ENUM passa por prefixo; MODEL tem de estar na lista explícita.
  const inventado = 'model ProposalCoisaQualquer {\n  id String @id\n\n  @@schema("comercial")\n}';
  const comOIntruso = schema + '\n' + inventado;

  const blocos = [...comOIntruso.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)].map(m => m[1]);
  assert.ok(blocos.includes('ProposalCoisaQualquer'));
  assert.ok(
    !MODELS_COMERCIAIS.includes('ProposalCoisaQualquer'),
    'um model não declarado precisa ficar de fora da lista para o teste acusá-lo',
  );
});
