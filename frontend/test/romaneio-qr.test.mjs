import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createServer } from 'vite';

async function loadRomaneioQr() {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule('/src/utils/romaneioQr.ts');
  } finally {
    await server.close();
  }
}

async function loadNavigation() {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule('/src/auth/moduleNavigation.ts');
  } finally {
    await server.close();
  }
}

test('QR do romaneio preserva o identificador do item em formato versionado', async () => {
  const { buildRomaneioItemQrValue, parseRomaneioItemQrValue } = await loadRomaneioQr();
  const value = buildRomaneioItemQrValue('cm123_item-9');

  assert.equal(value, 'FILTROVALI:ROMANEIO_ITEM:1:cm123_item-9');
  assert.equal(parseRomaneioItemQrValue(value), 'cm123_item-9');
});

test('leitor rejeita QR externo, versão desconhecida e identificador malformado', async () => {
  const { parseRomaneioItemQrValue } = await loadRomaneioQr();

  assert.equal(parseRomaneioItemQrValue('https://example.com/equipamento/123'), null);
  assert.equal(parseRomaneioItemQrValue('FILTROVALI:ROMANEIO_ITEM:2:item-1'), null);
  assert.equal(parseRomaneioItemQrValue('FILTROVALI:ROMANEIO_ITEM:1:item/1'), null);
});

test('itens não serializados e medidas variáveis pedem quantidade após o scan', async () => {
  const { romaneioQrRequiresQuantity } = await loadRomaneioQr();

  assert.equal(romaneioQrRequiresQuantity({ isSerialized: true, measureType: 'UNIT' }), false);
  assert.equal(romaneioQrRequiresQuantity({ isSerialized: false, measureType: 'UNIT' }), true);
  assert.equal(romaneioQrRequiresQuantity({ isSerialized: true, measureType: 'LENGTH' }), true);
  assert.equal(romaneioQrRequiresQuantity({ isSerialized: true, measureType: 'WEIGHT' }), true);
});

test('impressão em lote pagina todos os equipamentos e tamanhos sem perder etiquetas', async () => {
  const { paginateRomaneioQrLabels } = await loadRomaneioQr();
  const items = Array.from({ length: 13 }, (_, index) => ({ id: `item-${index + 1}` }));

  const smallPages = paginateRomaneioQrLabels(items, ['small']);
  const smallEntries = smallPages.map(page => page.rows.flatMap(row => row.entries));
  assert.equal(smallPages.length, 2);
  assert.equal(smallEntries[0].length, 12);
  assert.equal(smallEntries[1].length, 1);

  const mixedPages = paginateRomaneioQrLabels(items.slice(0, 2), ['large', 'medium', 'small']);
  const mixedEntries = mixedPages.flatMap(page => page.rows.flatMap(row => row.entries));
  assert.equal(mixedPages.length, 2);
  assert.equal(mixedEntries.length, 6);
  assert.deepEqual(
    mixedEntries.map(entry => `${entry.item.id}:${entry.size.id}`),
    [
      'item-1:large',
      'item-1:medium',
      'item-1:small',
      'item-2:large',
      'item-2:medium',
      'item-2:small'
    ]
  );
});

test('campanha do QR é individual e expira globalmente após dez dias', async () => {
  const stored = new Map();
  const originalNow = Date.now;
  globalThis.window = {
    localStorage: {
      getItem: key => stored.get(key) || null,
      setItem: (key, value) => stored.set(key, value)
    }
  };

  try {
    Date.now = () => new Date('2026-09-06T12:00:00-03:00').getTime();
    const navigation = await loadNavigation();
    assert.equal(navigation.ROMANEIO_QR_NOVELTY_IMPLEMENTED_AT, '2026-08-27');
    assert.equal(navigation.shouldShowRomaneioQrNovelty({ id: 'operator-1' }), true);
    navigation.markRomaneioQrNoveltySeen({ id: 'operator-1' });
    assert.equal(navigation.shouldShowRomaneioQrNovelty({ id: 'operator-1' }), false);
    assert.equal(navigation.shouldShowRomaneioQrNovelty({ id: 'operator-2' }), true);

    Date.now = () => new Date('2026-09-07T00:00:00-03:00').getTime();
    assert.equal(navigation.shouldShowRomaneioQrNovelty({ id: 'operator-3' }), false);
  } finally {
    Date.now = originalNow;
    delete globalThis.window;
  }
});

test('campanha apresenta etiquetas e scanner apontando para controles reais', async () => {
  const [noveltySource, overviewSource, formSource] = await Promise.all([
    readFile(new URL('../src/pages/romaneio/RomaneioQrNovelty.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/romaneio/RomaneioPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/romaneio/NewRomaneioPage.tsx', import.meta.url), 'utf8')
  ]);

  assert.match(noveltySource, /QR codes no romaneio/);
  assert.match(noveltySource, /QR_LABEL_TRIGGER_SELECTOR/);
  assert.match(noveltySource, /CATEGORY_QR_TRIGGER_SELECTOR/);
  assert.match(noveltySource, /QR_SCANNER_SELECTOR/);
  assert.match(overviewSource, /data-romaneio-category-qr-trigger/);
  assert.match(overviewSource, /data-romaneio-qr-label-trigger/);
  assert.match(formSource, /data-romaneio-qr-scanner-trigger/);
});
