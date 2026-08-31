import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let mod;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/levantamentoVinculado.ts');
});

test.after(async () => {
  await server?.close();
});

test('o Decimal da API vira moeda brasileira sem ganhar ou perder centavos', () => {
  assert.equal(mod.formatarValorDoLevantamento('38139.33'), 'R$ 38.139,33');
  assert.equal(mod.formatarValorDoLevantamento(100), 'R$ 100,00');
  assert.equal(mod.formatarValorDoLevantamento(null), '');
});

test('o preço do levantamento entra na proposta como verba global editável', () => {
  assert.deepEqual(
    mod.itemDePrecoDoLevantamento({
      title: 'Limpeza química do circuito A',
      salePrice: '38139.33'
    }),
    {
      description: 'Limpeza química do circuito A',
      unit: 'VB',
      quantity: '1',
      unitValue: 'R$ 38.139,33',
      value: 'R$ 38.139,33'
    }
  );
});

test('o local da obra vem do destino principal orçado no levantamento', () => {
  assert.equal(
    mod.localDaObraDoLevantamento({
      payload: {
        logisticsDestinations: [
          { id: 'apoio', address: 'Rua do Almoxarifado, 10' },
          {
            id: 'obra-principal',
            address: 'Rodovia BR-040, km 620 — Congonhas/MG'
          }
        ]
      }
    }),
    'Rodovia BR-040, km 620 — Congonhas/MG'
  );
});

test('levantamento antigo usa o primeiro destino com endereço', () => {
  assert.equal(
    mod.localDaObraDoLevantamento({
      payload: {
        logisticsDestinations: [
          { id: 'sem-endereco', address: '   ' },
          { id: 'destino-legado', address: 'Usina Industrial — Betim/MG' }
        ]
      }
    }),
    'Usina Industrial — Betim/MG'
  );
  assert.equal(mod.localDaObraDoLevantamento({ payload: {} }), '');
});
