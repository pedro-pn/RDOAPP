import assert from 'node:assert/strict';
import test from 'node:test';

process.env.GOOGLE_MAPS_MODE = 'real';
process.env.GOOGLE_MAPS_API_KEY = 'chave-de-teste';
process.env.GOOGLE_MAPS_MAX_DIA = '3';
process.env.COMERCIAL_SEDE_ENDERECO = 'Rua Rosa Orsi Dalçoquio, 930, Cordeiros, Itajaí - SC';

const { chaveDeCache, distanciaAteObra, limparCache } = await import(
  '../src/lib/comercial/distancias.js'
);

/**
 * Distância sede → obra (T126a).
 *
 * As respostas do Google são **as reais**, capturadas com a chave da empresa em
 * 11/08/2026 e reduzidas aos campos que o adaptador lê. Inventar formato aqui
 * provaria só que o código concorda com a minha imaginação.
 *
 * O que precisa ser provado é o tratamento da **ambiguidade silenciosa**:
 * "Unidade de Cubatão" devolve 595 km e um endereço que não é o da obra. Sem
 * aviso, o cálculo automático troca um campo em branco por um número errado — e
 * o branco alguém preenche, o número ninguém confere.
 */

/** Respostas reais, encurtadas. */
const GEOCODE = {
  'UHE São Manoel': {
    status: 'OK',
    results: [
      {
        formatted_address: 'R. Duzentos e Quatro, 4, Paranaíta - MT, 78590-000, Brasil',
        place_id: 'ChIJ9YA8kaG8q5MR1uoxkcuT7Z0',
        types: ['establishment', 'point_of_interest']
      }
    ]
  },
  'Unidade de Cubatão': {
    status: 'OK',
    results: [
      {
        formatted_address: 'Cubatão, SP, Brasil',
        place_id: 'ChIJ-cubatao',
        types: ['locality', 'political'],
        partial_match: true
      }
    ]
  },
  Cubatão: {
    status: 'OK',
    results: [
      {
        formatted_address: 'Cubatão, SP, Brasil',
        place_id: 'ChIJ-cubatao',
        types: ['locality', 'political']
      }
    ]
  },
  'asdkjhasd obra zzz 999': { status: 'ZERO_RESULTS', results: [] }
};

const ROTA = { 'ChIJ9YA8kaG8q5MR1uoxkcuT7Z0': 2706475, 'ChIJ-cubatao': 595000 };

/** Um `fetch` que responde do dicionário e conta as chamadas. */
function googleFalso({ semRota = false } = {}) {
  const chamadas = [];

  const buscar = async (url, opcoes = {}) => {
    chamadas.push(String(url));

    if (String(url).includes('geocode')) {
      const endereco = new URL(String(url)).searchParams.get('address');
      const corpo = GEOCODE[endereco] || { status: 'ZERO_RESULTS', results: [] };
      return { ok: true, json: async () => corpo };
    }

    const placeId = JSON.parse(opcoes.body).destination.placeId;
    const metros = semRota ? undefined : ROTA[placeId];
    return { ok: true, json: async () => ({ routes: metros ? [{ distanceMeters: metros }] : [] }) };
  };

  return { buscar, chamadas };
}

test.beforeEach(() => limparCache());

// ---------------------------------------------------------------------------
// O caminho feliz
// ---------------------------------------------------------------------------

test('nome de usina resolve para o endereço oficial, com a distância certa', async () => {
  const { buscar } = googleFalso();
  const resultado = await distanciaAteObra('UHE São Manoel', { buscar });

  assert.equal(resultado.km, 2706);
  assert.equal(
    resultado.enderecoEncontrado,
    'R. Duzentos e Quatro, 4, Paranaíta - MT, 78590-000, Brasil'
  );
  assert.equal(resultado.confianca, 'exata');
  assert.equal(resultado.aviso, '');
});

test('a rota é pedida pelo placeId que a geocodificação resolveu', async () => {
  // Mandar o texto de novo deixaria a Routes resolver por conta própria, e
  // possivelmente para outro lugar que o mostrado ao usuário.
  const { buscar, chamadas } = googleFalso();
  await distanciaAteObra('UHE São Manoel', { buscar });

  assert.match(chamadas[0], /geocode/);
  assert.match(chamadas[1], /computeRoutes/);
});

test('a distância sai em km inteiros', async () => {
  // 2.706.475 m. Casa decimal é precisão que a rota não tem.
  const { buscar } = googleFalso();
  assert.equal((await distanciaAteObra('UHE São Manoel', { buscar })).km, 2706);
});

// ---------------------------------------------------------------------------
// A AMBIGUIDADE SILENCIOSA — o caso que motivou o adaptador
// ---------------------------------------------------------------------------

test('O CASO CRÍTICO: "Unidade de Cubatão" avisa que achou só a cidade', async () => {
  const { buscar } = googleFalso();
  const resultado = await distanciaAteObra('Unidade de Cubatão', { buscar });

  // O número vem — ele é útil como ponto de partida.
  assert.equal(resultado.km, 595);
  // Mas NUNCA sozinho.
  assert.equal(resultado.confianca, 'parcial');
  assert.match(resultado.aviso, /Não achei exatamente/i);
  assert.match(resultado.aviso, /Cubatão, SP/);
});

test('cidade pedida de propósito avisa diferente de correspondência parcial', async () => {
  // "Cubatão" sozinho é resposta CORRETA para quem quis a cidade. O aviso existe,
  // mas diz outra coisa — e a diferença importa para quem lê.
  const { buscar } = googleFalso();
  const resultado = await distanciaAteObra('Cubatão', { buscar });

  assert.equal(resultado.confianca, 'regiao');
  assert.match(resultado.aviso, /apenas a cidade/i);
  assert.doesNotMatch(resultado.aviso, /Não achei exatamente/i);
});

test('endereço inexistente devolve resposta, não exceção', async () => {
  // Não encontrar é caminho normal: o campo continua editável e a pessoa digita.
  const { buscar } = googleFalso();
  const resultado = await distanciaAteObra('asdkjhasd obra zzz 999', { buscar });

  assert.equal(resultado.km, null);
  assert.equal(resultado.confianca, 'nenhuma');
  assert.match(resultado.aviso, /Não encontrei/i);
});

test('endereço achado mas sem rota rodoviária também é resposta', async () => {
  const { buscar } = googleFalso({ semRota: true });
  const resultado = await distanciaAteObra('UHE São Manoel', { buscar });

  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /não há rota rodoviária/i);
});

test('endereço vazio não gasta chamada', async () => {
  const { buscar, chamadas } = googleFalso();
  const resultado = await distanciaAteObra('   ', { buscar });

  assert.equal(resultado.km, null);
  assert.equal(chamadas.length, 0);
});

// ---------------------------------------------------------------------------
// Cache e cota — as duas proteções da franquia gratuita
// ---------------------------------------------------------------------------

test('a mesma obra consultada de novo não gasta chamada', async () => {
  const { buscar, chamadas } = googleFalso();

  await distanciaAteObra('UHE São Manoel', { buscar });
  assert.equal(chamadas.length, 2);

  await distanciaAteObra('UHE São Manoel', { buscar });
  assert.equal(chamadas.length, 2, 'a segunda consulta saiu para a rede');
});

test('a chave do cache ignora acento, caixa e pontuação', () => {
  assert.equal(chaveDeCache('UHE São Manoel'), chaveDeCache('uhe sao manoel'));
  assert.equal(chaveDeCache('Cubatão - SP'), chaveDeCache('cubatao  sp'));
  assert.notEqual(chaveDeCache('Cubatão'), chaveDeCache('Cubatão SP'));
});

test('a cota diária corta antes de a franquia acabar em silêncio', async () => {
  // Teto de 3 neste teste. Cada consulta gasta 2 chamadas, então a segunda
  // consulta esbarra. Um defeito em laço passaria das 10.000 do mês sem ninguém
  // notar, e só apareceria na fatura.
  const { buscar } = googleFalso();

  await distanciaAteObra('UHE São Manoel', { buscar });
  const segunda = await distanciaAteObra('Cubatão', { buscar });

  assert.equal(segunda.km, null);
  assert.match(segunda.aviso, /Limite diário/i);
});

test('serviço indisponível também vira resposta, não exceção', async () => {
  // Chave sem permissão, Google fora do ar, rede caída: do ponto de vista de
  // quem está na tela é tudo a mesma coisa — digita o número e segue. Um erro
  // subindo daqui faria a tela parecer quebrada com o trabalho podendo seguir.
  const buscar = async () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED', error_message: 'This API key is not authorized' }) });

  const resultado = await distanciaAteObra('UHE São Manoel', { buscar });

  assert.equal(resultado.km, null);
  // E o motivo técnico chega junto: quem lê "chave não autorizada" sabe a quem
  // avisar; "não consegui calcular" não diz nada.
  assert.match(resultado.aviso, /REQUEST_DENIED|não autorizada|not authorized/i);
});

test('rede fora do ar não derruba a tela', async () => {
  const buscar = async () => {
    throw new Error('getaddrinfo ENOTFOUND maps.googleapis.com');
  };

  const resultado = await distanciaAteObra('UHE São Manoel', { buscar });
  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /Google Maps/i);
});
