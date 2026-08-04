import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Otimização da foto do escopo no cliente (tarefa T058b, FR-048).
 *
 * O que dá para provar sem navegador é a **regra de redimensionamento** e os limites.
 * O desenho em canvas depende de DOM e fica para o aceite manual — mas é justamente a
 * regra, não o desenho, que erra em silêncio: uma proporção calculada errado só
 * aparece como foto esticada no PDF final.
 *
 * A cadeia de recusa do servidor tem teste próprio em
 * `backend/test/comercial-escopo-fotos.test.js`. As duas coberturas não são
 * redundantes: a daqui existe para caber, a de lá porque isto pode ser contornado.
 */

let server;
let mod;
let limites;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/scopePhoto.ts');
  ({ SCOPE_PHOTO_LIMITS: limites } = await server.ssrLoadModule(
    '/../shared/schemas/comercial.js'
  ));
});

test.after(async () => {
  await server?.close();
});

test('imagem menor que o limite não é ampliada', () => {
  // Ampliar não acrescenta detalhe nenhum e só engorda o arquivo.
  assert.deepEqual(mod.dimensoesReduzidas(800, 600), { width: 800, height: 600 });
  assert.deepEqual(mod.dimensoesReduzidas(1600, 900), { width: 1600, height: 900 });
});

test('o maior lado vira 1600 e a proporção é preservada', () => {
  // Foto de celular em pé, 12 MP.
  assert.deepEqual(mod.dimensoesReduzidas(3024, 4032), { width: 1200, height: 1600 });
  // Deitada.
  assert.deepEqual(mod.dimensoesReduzidas(4032, 3024), { width: 1600, height: 1200 });
});

test('proporção extrema não colapsa para zero', () => {
  // Um panorama 8000x200 reduz o lado menor para 40 — arredondar para baixo daria
  // 0, e um canvas de altura 0 desenha nada.
  const { width, height } = mod.dimensoesReduzidas(8000, 200);
  assert.equal(width, 1600);
  assert.ok(height >= 1, 'a altura não pode zerar');
});

test('a razão original é mantida dentro de um pixel', () => {
  const casos = [
    [3024, 4032],
    [4032, 3024],
    [1920, 1080],
    [2500, 2500]
  ];

  for (const [w, h] of casos) {
    const reduzida = mod.dimensoesReduzidas(w, h);
    const antes = w / h;
    const depois = reduzida.width / reduzida.height;
    assert.ok(
      Math.abs(antes - depois) < 0.01,
      `proporção mudou em ${w}x${h}: ${antes} → ${depois}`
    );
  }
});

test('os limites usados aqui são os MESMOS do servidor', () => {
  // Dois números iguais escritos em dois lugares divergem no primeiro ajuste, e a
  // divergência aparece como recusa do servidor num arquivo que a tela aceitou.
  assert.equal(limites.maxEdgePixels, 1600);
  assert.equal(limites.maxBytes, 1_500_000);
  assert.equal(limites.maxOriginalBytes, 10_000_000);
  assert.equal(limites.maxMegapixels, 24);
  assert.deepEqual(limites.allowedTypes, ['image/jpeg', 'image/png', 'image/webp']);
});

test('a recusa NOMEIA o arquivo', async () => {
  // Quem seleciona seis fotos de uma vez e lê "arquivo muito grande" não sabe qual
  // tirar da lista.
  const gif = { name: 'planta-baixa.gif', type: 'image/gif', size: 1000 };

  await assert.rejects(
    () => mod.otimizarFoto(gif),
    error => {
      assert.equal(error.name, 'FotoRecusadaError');
      assert.match(error.message, /planta-baixa\.gif/);
      assert.match(error.message, /JPEG, PNG ou WebP/);
      return true;
    }
  );
});

test('acima de 10 MB é recusado antes de decodificar', async () => {
  // Decodificar para depois recusar gastaria a memória do navegador do usuário à
  // toa — e é o navegador dele que trava, não o servidor.
  const enorme = {
    name: 'foto-crua.jpg',
    type: 'image/jpeg',
    size: limites.maxOriginalBytes + 1
  };

  await assert.rejects(
    () => mod.otimizarFoto(enorme),
    error => {
      assert.match(error.message, /foto-crua\.jpg/);
      assert.match(error.message, /10 MB/);
      return true;
    }
  );
});
