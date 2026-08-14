import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let rolarParaInicioDoFormulario;
let parametrosDoLevantamentoAposAvanco;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  ({ rolarParaInicioDoFormulario, parametrosDoLevantamentoAposAvanco } = await server.ssrLoadModule(
    '/src/pages/comercial/navegacao.ts'
  ));
});

test.after(async () => {
  await server?.close();
});

test('avançar leva o início do formulário para a área visível', () => {
  const chamadas = [];
  const elemento = {
    scrollIntoView: opcoes => chamadas.push(opcoes)
  };

  rolarParaInicioDoFormulario(elemento);

  assert.deepEqual(chamadas, [{ behavior: 'smooth', block: 'start' }]);
});

test('navegação não quebra quando o formulário ainda não montou', () => {
  assert.doesNotThrow(() => rolarParaInicioDoFormulario(null));
});

test('o primeiro avanço preserva no endereço o id do rascunho recém-criado', () => {
  const atuais = new URLSearchParams('modo=new&secao=premises');

  const proximos = parametrosDoLevantamentoAposAvanco(
    atuais,
    'labor',
    'levantamento-1'
  );

  assert.equal(proximos.get('secao'), 'labor');
  assert.equal(proximos.get('id'), 'levantamento-1');
});
