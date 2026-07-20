import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function loadPageScrollRestoration() {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule('/src/hooks/usePageScrollRestoration.ts');
  } finally {
    await server.close();
  }
}

test('page scroll storage key is scoped by user and full route', async () => {
  const { pageScrollStorageKey } = await loadPageScrollRestoration();
  const location = { pathname: '/rdo/gestor', search: '?tab=arquivados', hash: '#rel-20' };

  assert.equal(
    pageScrollStorageKey(location, 'manager-1'),
    'filtrovali:page-scroll:manager-1:/rdo/gestor?tab=arquivados#rel-20'
  );
  assert.notEqual(pageScrollStorageKey(location, 'manager-1'), pageScrollStorageKey(location, 'manager-2'));
});
