import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Rascunho local do módulo Comercial — lacuna **L3** (tarefas T089 a T092).
 *
 * O que está sendo protegido: na referência, um F5 na tela de custos apaga 465
 * controles de trabalho sem aviso. O mantenedor citou *"fechar a página sem
 * querer"* como perda real.
 *
 * Estes testes cobrem a regra, que é onde os enganos moram — validade, chave e
 * registro corrompido. O *debounce* e o `beforeunload` ficam no hook.
 */

let server;
let mod;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/rascunhoLocal.ts');
});

test.after(async () => {
  await server?.close();
});

/** `localStorage` de mentira, com o mesmo contrato — inclusive `length` e `key`. */
function storageFalso(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    get length() {
      return dados.size;
    },
    key: i => [...dados.keys()][i] ?? null,
    getItem: chave => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
    removeItem: chave => dados.delete(chave),
    _dados: dados
  };
}

test('a chave separa conta, modo e código da proposta', () => {
  // Um rascunho da 4435 reaparecendo na 4436 seriam números do cliente errado
  // numa proposta que já tem dono.
  const a = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');
  const b = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4436');
  const c = mod.chaveDoRascunho('u-ana', 'custos', 'revision', '4435');
  const d = mod.chaveDoRascunho('u-bruno', 'custos', 'new', '4435');

  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d, 'contas no mesmo navegador não podem compartilhar rascunho');
  assert.equal(
    a,
    mod.chaveDoRascunho('u-ana', 'custos', 'new', '  4435  '),
    'código vem normalizado'
  );
});

test('guarda e lê de volta', () => {
  const storage = storageFalso();
  const chave = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');

  assert.equal(mod.guardarRascunho(storage, chave, { title: 'Limpeza química' }), true);

  const lido = mod.lerRascunho(storage, chave);
  assert.deepEqual(lido.dados, { title: 'Limpeza química' });
  assert.equal(typeof lido.salvoEm, 'number');
});

test('rascunho vencido não é oferecido, e some', () => {
  // Oferecer trabalho de duas semanas atrás confunde mais do que ajuda: o
  // usuário não lembra o que havia ali e aceita sem conferir.
  const storage = storageFalso();
  const chave = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');
  const agora = Date.now();

  mod.guardarRascunho(storage, chave, { title: 'velho' }, undefined, agora - mod.VALIDADE_MS - 1);

  assert.equal(mod.lerRascunho(storage, chave, agora), null);
  assert.equal(storage.getItem(chave), null, 'o vencido é apagado, não só ignorado');
});

test('registro corrompido é descartado em silêncio', () => {
  // Oferecer "recuperar" e falhar na restauração seria prometer o trabalho de
  // volta e não entregar.
  const storage = storageFalso({ 'filtrovali:comercial:rascunho:u-ana:custos:new:4435': '{ isto não é json' });
  const chave = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');

  assert.equal(mod.lerRascunho(storage, chave), null);
  assert.equal(storage.getItem(chave), null);
});

test('registro sem os campos esperados também é descartado', () => {
  const storage = storageFalso();
  const chave = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');
  storage.setItem(chave, JSON.stringify({ dados: { a: 1 } })); // sem salvoEm

  assert.equal(mod.lerRascunho(storage, chave), null);
});

test('storage indisponível não derruba a tela', () => {
  // O rascunho é rede de segurança, não caminho principal. Cota estourada ou
  // navegador em modo restrito não podem quebrar o levantamento em andamento.
  const quebrado = {
    length: 0,
    key: () => null,
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('cota');
    },
    removeItem: () => {
      throw new Error('bloqueado');
    }
  };
  const chave = mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435');

  assert.equal(mod.guardarRascunho(quebrado, chave, { a: 1 }), false);
  assert.equal(mod.lerRascunho(quebrado, chave), null);
  assert.doesNotThrow(() => mod.descartarRascunho(quebrado, chave));
  assert.doesNotThrow(() => mod.descartarRascunhosDaTela(quebrado, 'u-ana', 'custos'));
});

test('salvar no servidor limpa TODO rascunho da tela', () => {
  // T091: não pode sobrar para reaparecer depois como trabalho não salvo.
  const storage = storageFalso();
  mod.guardarRascunho(storage, mod.chaveDoRascunho('u-ana', 'custos', 'new', '4435'), { a: 1 });
  mod.guardarRascunho(storage, mod.chaveDoRascunho('u-ana', 'custos', 'revision', '4400'), { b: 2 });
  mod.guardarRascunho(storage, mod.chaveDoRascunho('u-ana', 'proposta', 'new', '4435'), { c: 3 });
  mod.guardarRascunho(storage, mod.chaveDoRascunho('u-bruno', 'custos', 'new', '4435'), { d: 4 });

  mod.descartarRascunhosDaTela(storage, 'u-ana', 'custos');

  assert.equal(storage.length, 2, 'a outra tela e a outra conta sobrevivem');
  assert.ok(mod.lerRascunho(storage, mod.chaveDoRascunho('u-ana', 'proposta', 'new', '4435')));
  assert.ok(mod.lerRascunho(storage, mod.chaveDoRascunho('u-bruno', 'custos', 'new', '4435')));
});

test('a idade é dita em português comum', () => {
  const agora = Date.now();
  assert.equal(mod.descreverIdade(agora, agora), 'agora há pouco');
  assert.equal(mod.descreverIdade(agora - 60_000, agora), 'há 1 minuto');
  assert.equal(mod.descreverIdade(agora - 25 * 60_000, agora), 'há 25 minutos');
  assert.equal(mod.descreverIdade(agora - 3 * 3_600_000, agora), 'há 3 horas');
  assert.equal(mod.descreverIdade(agora - 26 * 3_600_000, agora), 'ontem');
  assert.equal(mod.descreverIdade(agora - 3 * 86_400_000, agora), 'há 3 dias');
});
