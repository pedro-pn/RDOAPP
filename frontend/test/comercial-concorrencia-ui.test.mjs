import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let api;
let dialogo;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom'
  });
  api = await server.ssrLoadModule('/src/api/comercial.ts');
  dialogo = await server.ssrLoadModule(
    '/src/pages/comercial/components/ConflitoDeEdicaoDialog.tsx'
  );
});

test.after(async () => {
  await server?.close();
});

test('o 409 estruturado vira um erro de concorrência, não erro genérico', () => {
  const error = api.interpretarConflitoDeEdicao({
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        code: api.CONCURRENT_WRITE_CODE,
        error: 'Alterado por Colega Ana.',
        conflict: {
          updatedAt: '2026-08-13T12:05:00.000Z',
          updatedByUserId: 'u-ana',
          updatedByLabel: 'Colega Ana'
        }
      }
    }
  });

  assert.ok(error instanceof api.ComercialConcurrentWriteError);
  assert.equal(error.conflict.updatedByLabel, 'Colega Ana');
});

test('o diálogo oferece recarregar ou prosseguir, sem transformar aviso em trava', () => {
  const conflito = new api.ComercialConcurrentWriteError('Alterado por Colega Ana.', {
    updatedAt: '2026-08-13T12:05:00.000Z',
    updatedByUserId: 'u-ana',
    updatedByLabel: 'Colega Ana'
  });
  const html = renderToStaticMarkup(
    createElement(dialogo.ConflitoDeEdicaoDialog, {
      conflito,
      salvando: false,
      onRecarregar: () => {},
      onProsseguir: () => {},
      onCancelar: () => {}
    })
  );

  assert.match(html, /Recarregar versão atual/);
  assert.match(html, /Prosseguir e sobrescrever/);
  assert.match(html, /Colega Ana/);
});
