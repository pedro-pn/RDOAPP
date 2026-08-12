import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * O que a tela faz com o resultado do cálculo de distância (T126b).
 *
 * A distância só ida multiplica quase todo custo de logística. Um número errado
 * aqui não aparece em lugar nenhum depois — sai no preço e ninguém reconfere.
 *
 * O caso que este arquivo existe para trancar é a **ambiguidade silenciosa**:
 * "Unidade de Cubatão" devolve 595 km e a cidade de Cubatão. Número plausível,
 * destino errado. Preencher isso calado troca um campo em branco por um número
 * errado — e é pior, porque o branco alguém preenche e o número ninguém confere.
 */

let server;
let decidirDistancia;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  ({ decidirDistancia } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/distancia.ts'
  ));
});

test.after(async () => {
  await server?.close();
});

test('endereço exato preenche sem pedir nada', () => {
  const decisao = decidirDistancia({
    km: 2706,
    enderecoEncontrado: 'R. Duzentos e Quatro, 4, Paranaíta - MT, Brasil',
    confianca: 'exata',
    aviso: ''
  });

  assert.equal(decisao.preencher, true);
  assert.equal(decisao.km, 2706);
  assert.equal(decisao.tom, 'ok');
  assert.match(decisao.recado, /Paranaíta/);
});

test('O CASO CRÍTICO: correspondência parcial preenche mas PEDE conferência', () => {
  const decisao = decidirDistancia({
    km: 595,
    enderecoEncontrado: 'Cubatão, SP, Brasil',
    confianca: 'parcial',
    aviso: 'Não achei exatamente o que foi digitado. Usei "Cubatão, SP, Brasil" — confira antes de seguir.'
  });

  // Preenche: o número é ponto de partida útil, e apagá-lo obrigaria a digitar
  // do zero um valor que está quase certo.
  assert.equal(decisao.preencher, true);
  assert.equal(decisao.km, 595);
  // Mas NUNCA calado.
  assert.equal(decisao.tom, 'aviso');
  assert.match(decisao.recado, /confira/i);
});

test('achou só a cidade também pede conferência', () => {
  const decisao = decidirDistancia({
    km: 595,
    enderecoEncontrado: 'Cubatão, SP, Brasil',
    confianca: 'regiao',
    aviso: 'Achei apenas a cidade (Cubatão, SP, Brasil), não o endereço da obra.'
  });

  assert.equal(decisao.tom, 'aviso');
  assert.match(decisao.recado, /apenas a cidade/i);
  // O número aparece no recado: quem confere precisa ver o que foi preenchido.
  assert.match(decisao.recado, /595/);
});

test('sem número não preenche, e repassa o motivo DO SERVIDOR', () => {
  // As mensagens do adaptador são específicas — "chave não autorizada", "limite
  // diário atingido", "não há rota rodoviária". Trocá-las por um texto genérico
  // da tela jogaria fora justamente o que diz o que fazer a seguir.
  const casos = [
    'A chave do Google Maps não está configurada (GOOGLE_MAPS_API_KEY).',
    'Limite diário de consultas de distância atingido (200). Informe a distância manualmente.',
    'O endereço da sede ainda não foi configurado. Um gestor do módulo pode informá-lo em Configurações.',
    'Encontrei "UHE São Manoel", mas não há rota rodoviária a partir da sede.'
  ];

  for (const aviso of casos) {
    const decisao = decidirDistancia({ km: null, enderecoEncontrado: '', confianca: 'nenhuma', aviso });
    assert.equal(decisao.preencher, false, aviso);
    assert.equal(decisao.km, null);
    assert.equal(decisao.tom, 'erro');
    assert.equal(decisao.recado, aviso, 'a mensagem do servidor foi trocada por uma genérica');
  }
});

test('resposta sem número e sem motivo ainda diz alguma coisa', () => {
  // Campo de recado vazio deixaria o usuário clicando sem retorno nenhum.
  const decisao = decidirDistancia({ km: null, enderecoEncontrado: '', confianca: 'nenhuma', aviso: '' });
  assert.equal(decisao.preencher, false);
  assert.ok(decisao.recado.length > 0);
});

test('zero quilômetros é resposta, não ausência de resposta', () => {
  // Obra na própria sede. `km: 0` é falsy — tratá-lo como "não achou" faria a
  // tela recusar um resultado correto.
  const decisao = decidirDistancia({
    km: 0,
    enderecoEncontrado: 'Rua Rosa Orsi Dalçoquio, 930 - Itajaí, SC',
    confianca: 'exata',
    aviso: ''
  });

  assert.equal(decisao.preencher, true);
  assert.equal(decisao.km, 0);
  assert.equal(decisao.tom, 'ok');
});
