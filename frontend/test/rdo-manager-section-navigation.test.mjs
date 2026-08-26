import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadModule(path) {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule(path);
  } finally {
    await server.close();
  }
}

test('RDO manager navigation exposes the eight real sections in product order', async () => {
  const { RDO_MANAGER_SECTIONS } = await loadModule(
    '/src/pages/gestor/rdoSectionNavigationModel.ts'
  );

  assert.deepEqual(
    RDO_MANAGER_SECTIONS.map((section) => section.id),
    [
      'pendentes',
      'aprovados',
      'projetos',
      'arquivados',
      'equipe',
      'usuarios',
      'nps',
      'estatisticas'
    ]
  );
});

test('RDO manager navigation preserves unrelated query params and canonical pending URL', async () => {
  const { rdoManagerSectionHref } = await loadModule(
    '/src/pages/gestor/rdoSectionNavigationModel.ts'
  );

  assert.equal(
    rdoManagerSectionHref('projetos', '?project=42&tab=aprovados'),
    '/rdo/gestor?project=42&tab=projetos'
  );
  assert.equal(
    rdoManagerSectionHref('pendentes', '?project=42&tab=projetos'),
    '/rdo/gestor?project=42'
  );
});

test('RDO manager renders one compact mobile selector instead of global tabs', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const navigation = source('src/pages/gestor/RdoSectionNavigation.tsx');
  const css = source('src/pages/gestor/GestorPage.ds.css');

  assert.doesNotMatch(
    page,
    /rdo-manager-tabs-wrap|aria-label="Seções do gestor"/
  );
  assert.match(page, /<RdoSectionNavigation/);
  assert.match(
    navigation,
    /aria-label="Navegar nas áreas de Relatórios e Projetos"/
  );
  assert.match(navigation, /Relatórios e Projetos · \$\{section\.label\}/);
  assert.match(css, /\.rdo-section-navigation\s*\{/);
  assert.match(
    css,
    /@media \(min-width:\s*1024px\)[\s\S]*\.rdo-section-navigation\s*\{[\s\S]*display:\s*none/
  );
});
