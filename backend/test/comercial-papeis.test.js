import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Os três papéis do módulo Comercial (§12.5.1 do docs/PLANO_MODULO_COMERCIAL.md).
 *
 * Este teste guarda a FORMA do modelo de permissão — que os três papéis existem,
 * com os rótulos certos, e que o papel de consulta não é orçamentista. A
 * verificação de autoria (vendedor alcança só o que é seu) mora em
 * lib/comercial/access.js e tem teste próprio: middleware de papel sabe o papel,
 * não sabe a autoria do registro.
 */

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(
  readFileSync(join(here, '../../shared/modules/registry.json'), 'utf8'),
);
const comercial = registry.modules.find((item) => item.id === 'comercial');

test('o módulo Comercial está registrado', () => {
  assert.ok(comercial, 'módulo comercial ausente do registry');
  assert.equal(comercial.prismaModule, 'COMERCIAL');
  assert.equal(comercial.badge, 'COM');
});

test('são três papéis: gestor, vendedor e consulta', () => {
  const codes = comercial.roles.map((role) => role.public);
  assert.deepEqual(codes, [
    'comercial:manager',
    'comercial:seller',
    'comercial:viewer',
  ]);

  const labels = Object.fromEntries(
    comercial.roles.map((role) => [role.public, role.label]),
  );
  assert.equal(labels['comercial:manager'], 'Comercial - Gestor');
  assert.equal(labels['comercial:seller'], 'Comercial - Vendedor');
  assert.equal(labels['comercial:viewer'], 'Comercial - Consulta');
});

test('o grupo de rotas "estimator" exclui o papel de consulta', () => {
  // É o gate do levantamento de custos. Custo e margem não aparecem para o
  // papel de consulta em nenhuma superfície — nem por endereço direto.
  const estimator = comercial.routeGroups.estimator;
  assert.ok(estimator, 'routeGroups.estimator ausente');
  assert.deepEqual(estimator.allowedModuleRoles, [
    'comercial:manager',
    'comercial:seller',
  ]);
  assert.ok(
    !estimator.allowedModuleRoles.includes('comercial:viewer'),
    'o papel de consulta não pode alcançar o levantamento',
  );
});

test('o hub oferece o módulo aos três papéis', () => {
  assert.deepEqual(comercial.hub.roles, [
    'comercial:manager',
    'comercial:seller',
    'comercial:viewer',
  ]);
  assert.equal(comercial.hub.path, '/comercial');
});

test('as rotas do módulo estão declaradas', () => {
  assert.deepEqual(comercial.routes, {
    index: '/comercial',
    custos: '/comercial/custos',
    propostas: '/comercial/propostas',
    historico: '/comercial/historico',
    configuracoes: '/comercial/configuracoes',
  });
});

test('o grupo de acesso da configuração é só do gestor', () => {
  // O que se muda ali — a origem de todas as distâncias — vale para as propostas
  // de todo mundo. Vendedor e consulta não entram.
  assert.deepEqual(comercial.routeGroups.manager.allowedModuleRoles, ['comercial:manager']);
});

test('a migration cria os três valores de enum', () => {
  const sql = readFileSync(
    join(
      here,
      '../prisma/migrations/20260731223632_add_comercial_module/migration.sql',
    ),
    'utf8',
  );
  assert.match(sql, /AppModule.*COMERCIAL/s);
  for (const code of [
    'COMERCIAL_MANAGER',
    'COMERCIAL_SELLER',
    'COMERCIAL_VIEWER',
  ]) {
    assert.ok(sql.includes(code), `migration não cria ${code}`);
  }
});
