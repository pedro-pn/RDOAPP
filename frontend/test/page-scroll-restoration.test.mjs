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

function setGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true
  });
  return () => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      delete globalThis[name];
    }
  };
}

test('page scroll storage key is scoped by user and full route', async () => {
  const { pageScrollRestoreStateFromNavigation, pageScrollStorageKey } = await loadPageScrollRestoration();
  const location = { pathname: '/rdo/gestor', search: '?tab=arquivados', hash: '#rel-20' };

  assert.equal(
    pageScrollStorageKey(location, 'manager-1'),
    'filtrovali:page-scroll:manager-1:/rdo/gestor?tab=arquivados#rel-20'
  );
  assert.notEqual(pageScrollStorageKey(location, 'manager-1'), pageScrollStorageKey(location, 'manager-2'));
  assert.deepEqual(pageScrollRestoreStateFromNavigation({ restoreScrollTop: 820 }), { restoreScrollTop: 820 });
  assert.equal(pageScrollRestoreStateFromNavigation({ restoreScrollTop: 0 }), undefined);
});

test('page scroll state captures document scroll when page-scroll is not the scroller', async () => {
  const { currentPageScrollState, pageScrollStorageKey, saveCurrentPageScroll } = await loadPageScrollRestoration();
  const writes = new Map();
  const pageScroll = { scrollTop: 0 };
  const scrollingElement = { scrollTop: 744 };
  const restoreDocument = setGlobal('document', {
    body: { scrollTop: 0 },
    documentElement: { scrollTop: 744 },
    querySelector: selector => (selector === '.page-scroll' ? pageScroll : null),
    scrollingElement
  });
  const restoreWindow = setGlobal('window', {
    scrollY: 744,
    sessionStorage: {
      getItem: key => writes.get(key) ?? null,
      setItem: (key, value) => {
        writes.set(key, value);
      }
    }
  });

  try {
    const location = { pathname: '/rdo/coordenador', search: '?tab=approved', hash: '' };
    const storageKey = pageScrollStorageKey(location, 'coordinator-1');

    assert.deepEqual(currentPageScrollState(), { restoreScrollTop: 744 });
    assert.equal(saveCurrentPageScroll(location, 'coordinator-1'), 744);
    assert.equal(writes.get(storageKey), '744');
  } finally {
    restoreWindow();
    restoreDocument();
  }
});
