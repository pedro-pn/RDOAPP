import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * A máscara de R$ dos campos de valor — desvio nº 14, aprovado em 11/08.
 *
 * O que precisa ser provado é a **ida e volta**: a tela guarda número, porque é
 * ele que alimenta o cálculo ao vivo, e mostra texto formatado. Um dos dois
 * lados errado produz o pior defeito possível nesta tela — um total plausível e
 * errado, que ninguém confere.
 */

let server;
let mod;
let etapas;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/custos/formato.ts');
  etapas = await server.ssrLoadModule('/src/pages/comercial/proposta/etapas.ts');
});

test.after(async () => {
  await server?.close();
});

test('os dígitos são lidos como CENTAVOS', () => {
  // Digitar 12345 dá R$ 123,45. É o que resolve a ambiguidade de quem digita
  // 1.500 querendo dizer mil e quinhentos.
  assert.equal(mod.dinheiroDigitado('2'), 0.02);
  assert.equal(mod.dinheiroDigitado('25'), 0.25);
  assert.equal(mod.dinheiroDigitado('2500'), 25);
  assert.equal(mod.dinheiroDigitado('12345'), 123.45);
  assert.equal(mod.dinheiroDigitado('250000'), 2500);
});

test('campo apagado vale ZERO, nunca NaN', () => {
  // NaN entraria no cálculo e contaminaria o total inteiro sem erro visível.
  assert.equal(mod.dinheiroDigitado(''), 0);
  assert.equal(mod.dinheiroDigitado('abc'), 0);
  assert.equal(mod.dinheiroDigitado(null), 0);
  assert.equal(mod.dinheiroDigitado(undefined), 0);
});

test('a ida e a volta se fecham', () => {
  // É o ciclo real do campo: o valor sai formatado, volta pelo onChange e tem
  // de dar o mesmo número. Sem isso, cada tecla degrada o valor.
  for (const valor of [0, 0.01, 25, 123.45, 2500, 105920.8]) {
    const texto = mod.mascaraDeDinheiro(valor);
    assert.equal(mod.dinheiroDigitado(texto), valor, `quebrou em ${valor}`);
  }
});

/**
 * O `Intl` separa "R$" do número com **espaço não-quebrável** (U+00A0), não com
 * espaço comum. Comparar com literal digitado no editor falha por um caractere
 * invisível — e a mensagem mostra duas strings idênticas na tela.
 */
const semNbsp = texto => String(texto).replace(/\u00a0/g, ' ');

test('a máscara sai no formato brasileiro', () => {
  assert.equal(semNbsp(mod.mascaraDeDinheiro(123.45)), 'R$ 123,45');
  assert.equal(semNbsp(mod.mascaraDeDinheiro(2500)), 'R$ 2.500,00');
  assert.equal(semNbsp(mod.mascaraDeDinheiro(0)), 'R$ 0,00');
});

test('valor inválido vira R$ 0,00 em vez de "R$ NaN"', () => {
  assert.equal(semNbsp(mod.mascaraDeDinheiro(undefined)), 'R$ 0,00');
  assert.equal(semNbsp(mod.mascaraDeDinheiro('abc')), 'R$ 0,00');
});

test('o comportamento é o MESMO da etapa Comercial da proposta', () => {
  // É a razão de o desvio ter escolhido centavos-ao-digitar: as duas telas do
  // módulo pedem valor, e com comportamentos diferentes quem passa de uma para
  // a outra digita errado na segunda.
  for (const digitado of ['2', '25', '2500', '12345', '250000']) {
    assert.equal(
      mod.mascaraDeDinheiro(mod.dinheiroDigitado(digitado)),
      etapas.formatarDinheiro(digitado),
      `divergiu ao digitar ${digitado}`
    );
  }
});

test('colar um valor já formatado não o multiplica', () => {
  // Colar "R$ 1.234,56" tem de dar 1234,56 — não 123456, que é o que aconteceria
  // se os separadores entrassem como dígitos.
  assert.equal(mod.dinheiroDigitado('R$ 1.234,56'), 1234.56);
  assert.equal(semNbsp(mod.mascaraDeDinheiro(mod.dinheiroDigitado('R$ 1.234,56'))), 'R$ 1.234,56');
});
