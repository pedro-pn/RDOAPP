import assert from 'node:assert/strict';
import test from 'node:test';

process.env.GOOGLE_MAPS_MODE = 'real';
process.env.GOOGLE_MAPS_API_KEY = 'chave-de-teste';
process.env.GOOGLE_MAPS_MAX_DIA = '3';
process.env.GOOGLE_MAPS_MAX_DIA_SUGESTOES = '3';

const { chaveDeCache, distanciaAteObra, limparCache, localizarEndereco, sugerirEnderecos } =
  await import('../src/lib/comercial/distancias.js');

/**
 * A sede vem de fora desde a T131 — é configuração do módulo, não variável de
 * ambiente. Aqui ela é fixa, e cada caso a passa como o servidor passaria.
 */
const SEDE = {
  endereco: 'Rua Rosa Orsi Dalçoquio, 930, Cordeiros, Itajaí - SC',
  placeId: 'ChIJ-sede-itajai'
};

/** O mesmo `distanciaAteObra`, com a sede já no lugar. */
const distancia = (endereco, opcoes = {}) =>
  distanciaAteObra(endereco, { sede: SEDE, ...opcoes });

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
  /** Os corpos enviados à Routes — é neles que a ORIGEM aparece. */
  const corpos = [];

  const buscar = async (url, opcoes = {}) => {
    chamadas.push(String(url));

    if (String(url).includes('geocode')) {
      const endereco = new URL(String(url)).searchParams.get('address');
      const corpo = GEOCODE[endereco] || { status: 'ZERO_RESULTS', results: [] };
      return { ok: true, json: async () => corpo };
    }

    const pedido = JSON.parse(opcoes.body);
    corpos.push(pedido);
    const metros = semRota ? undefined : ROTA[pedido.destination.placeId];
    return { ok: true, json: async () => ({ routes: metros ? [{ distanceMeters: metros }] : [] }) };
  };

  return { buscar, chamadas, corpos };
}

test.beforeEach(() => limparCache());

// ---------------------------------------------------------------------------
// O caminho feliz
// ---------------------------------------------------------------------------

test('nome de usina resolve para o endereço oficial, com a distância certa', async () => {
  const { buscar } = googleFalso();
  const resultado = await distancia('UHE São Manoel', { buscar });

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
  await distancia('UHE São Manoel', { buscar });

  assert.match(chamadas[0], /geocode/);
  assert.match(chamadas[1], /computeRoutes/);
});

test('a distância sai em km inteiros', async () => {
  // 2.706.475 m. Casa decimal é precisão que a rota não tem.
  const { buscar } = googleFalso();
  assert.equal((await distancia('UHE São Manoel', { buscar })).km, 2706);
});

// ---------------------------------------------------------------------------
// A AMBIGUIDADE SILENCIOSA — o caso que motivou o adaptador
// ---------------------------------------------------------------------------

test('O CASO CRÍTICO: "Unidade de Cubatão" avisa que achou só a cidade', async () => {
  const { buscar } = googleFalso();
  const resultado = await distancia('Unidade de Cubatão', { buscar });

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
  const resultado = await distancia('Cubatão', { buscar });

  assert.equal(resultado.confianca, 'regiao');
  assert.match(resultado.aviso, /apenas a cidade/i);
  assert.doesNotMatch(resultado.aviso, /Não achei exatamente/i);
});

test('endereço inexistente devolve resposta, não exceção', async () => {
  // Não encontrar é caminho normal: o campo continua editável e a pessoa digita.
  const { buscar } = googleFalso();
  const resultado = await distancia('asdkjhasd obra zzz 999', { buscar });

  assert.equal(resultado.km, null);
  assert.equal(resultado.confianca, 'nenhuma');
  assert.match(resultado.aviso, /Não encontrei/i);
});

test('endereço achado mas sem rota rodoviária também é resposta', async () => {
  const { buscar } = googleFalso({ semRota: true });
  const resultado = await distancia('UHE São Manoel', { buscar });

  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /não há rota rodoviária/i);
});

test('endereço vazio não gasta chamada', async () => {
  const { buscar, chamadas } = googleFalso();
  const resultado = await distancia('   ', { buscar });

  assert.equal(resultado.km, null);
  assert.equal(chamadas.length, 0);
});

// ---------------------------------------------------------------------------
// Cache e cota — as duas proteções da franquia gratuita
// ---------------------------------------------------------------------------

test('a mesma obra consultada de novo não gasta chamada', async () => {
  const { buscar, chamadas } = googleFalso();

  await distancia('UHE São Manoel', { buscar });
  assert.equal(chamadas.length, 2);

  await distancia('UHE São Manoel', { buscar });
  assert.equal(chamadas.length, 2, 'a segunda consulta saiu para a rede');
});

test('a chave do cache ignora acento, caixa e pontuação', () => {
  const sede = SEDE.placeId;
  assert.equal(chaveDeCache(sede, 'UHE São Manoel'), chaveDeCache(sede, 'uhe sao manoel'));
  assert.equal(chaveDeCache(sede, 'Cubatão - SP'), chaveDeCache(sede, 'cubatao  sp'));
  assert.notEqual(chaveDeCache(sede, 'Cubatão'), chaveDeCache(sede, 'Cubatão SP'));
});

test('MUDAR A SEDE muda a chave — senão o cache responde a distância da sede antiga', async () => {
  // Desde a T131 a sede é editável na tela. Com a chave só do destino, a
  // primeira obra consultada depois da mudança continuaria respondendo a
  // distância do prédio velho, em silêncio e só nos processos que já tinham a
  // resposta guardada.
  assert.notEqual(
    chaveDeCache('ChIJ-sede-itajai', 'UHE São Manoel'),
    chaveDeCache('ChIJ-sede-outra', 'UHE São Manoel')
  );

  const { buscar, chamadas } = googleFalso();
  await distanciaAteObra('UHE São Manoel', { buscar, sede: SEDE });
  await distanciaAteObra('UHE São Manoel', {
    buscar,
    sede: { endereco: 'Outro endereço', placeId: 'ChIJ-sede-outra' }
  });

  // A segunda consulta volta à rede em vez de responder do cache. Ela não chega
  // às 4 chamadas porque o teto diário deste arquivo é 3 — o que importa aqui é
  // que passou de 2, e não que tenha completado.
  assert.ok(chamadas.length > 2, 'a segunda sede reaproveitou o cache da primeira');
});

// ---------------------------------------------------------------------------
// A sede — configuração do módulo desde a T131
// ---------------------------------------------------------------------------

test('sem sede configurada, a resposta manda para a tela certa', async () => {
  // Não para o `.env`: a variável deixou de existir, e quem resolve isto é um
  // gestor numa tela do módulo.
  const { buscar, chamadas } = googleFalso();
  const resultado = await distanciaAteObra('UHE São Manoel', { buscar, sede: {} });

  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /sede/i);
  assert.match(resultado.aviso, /Configurações/i);
  assert.equal(chamadas.length, 0, 'gastou chamada sem ter de onde sair');
});

test('a rota sai do placeId da sede, não do texto', async () => {
  // O mesmo cuidado que o destino já tinha: com texto, a Routes reinterpreta o
  // endereço a cada cálculo — e aí seria na ORIGEM, onde ninguém olha, porque a
  // tela mostra o destino.
  const { buscar, corpos } = googleFalso();
  await distanciaAteObra('UHE São Manoel', { buscar, sede: SEDE });

  assert.deepEqual(corpos[0].origin, { placeId: 'ChIJ-sede-itajai' });
});

test('sede sem placeId ainda calcula, pelo texto', async () => {
  // Acontece quando o endereço foi salvo com o Maps desligado — que é o padrão
  // do ambiente. Recusar aqui deixaria a configuração inútil no caso mais comum.
  const { buscar, corpos } = googleFalso();
  const resultado = await distanciaAteObra('UHE São Manoel', {
    buscar,
    sede: { endereco: 'Rua Rosa Orsi Dalçoquio, 930, Itajaí - SC' }
  });

  assert.equal(resultado.km, 2706);
  assert.deepEqual(corpos[0].origin, { address: 'Rua Rosa Orsi Dalçoquio, 930, Itajaí - SC' });
});

// ---------------------------------------------------------------------------
// Localizar sem calcular — o botão da tela de configuração
// ---------------------------------------------------------------------------

test('localizar devolve o endereço oficial e o placeId, sem pedir rota', async () => {
  const { buscar, chamadas } = googleFalso();
  const local = await localizarEndereco('UHE São Manoel', { buscar });

  assert.equal(local.placeId, 'ChIJ9YA8kaG8q5MR1uoxkcuT7Z0');
  assert.equal(local.confianca, 'exata');
  assert.equal(chamadas.length, 1, 'pediu rota para localizar um endereço');
  assert.doesNotMatch(chamadas[0], /computeRoutes/);
});

test('localizar não precisa de sede — é ela que está sendo configurada', async () => {
  // A ordem importa: exigir sede para localizar tornaria impossível configurar a
  // primeira sede.
  const { buscar } = googleFalso();
  const local = await localizarEndereco('UHE São Manoel', { buscar });
  assert.equal(local.aviso, '');
});

test('localizar avisa quando acha só a cidade, e não lança', async () => {
  const { buscar } = googleFalso();

  const parcial = await localizarEndereco('Unidade de Cubatão', { buscar });
  assert.equal(parcial.confianca, 'parcial');
  assert.match(parcial.aviso, /Não achei exatamente/i);

  const nenhum = await localizarEndereco('asdkjhasd obra zzz 999', { buscar });
  assert.equal(nenhum.placeId, '');
  assert.match(nenhum.aviso, /Não encontrei/i);
});

test('a cota diária corta antes de a franquia acabar em silêncio', async () => {
  // Teto de 3 neste teste. Cada consulta gasta 2 chamadas, então a segunda
  // consulta esbarra. Um defeito em laço passaria das 10.000 do mês sem ninguém
  // notar, e só apareceria na fatura.
  const { buscar } = googleFalso();

  await distancia('UHE São Manoel', { buscar });
  const segunda = await distancia('Cubatão', { buscar });

  assert.equal(segunda.km, null);
  assert.match(segunda.aviso, /Limite diário/i);
});

test('serviço indisponível também vira resposta, não exceção', async () => {
  // Chave sem permissão, Google fora do ar, rede caída: do ponto de vista de
  // quem está na tela é tudo a mesma coisa — digita o número e segue. Um erro
  // subindo daqui faria a tela parecer quebrada com o trabalho podendo seguir.
  const buscar = async () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED', error_message: 'This API key is not authorized' }) });

  const resultado = await distancia('UHE São Manoel', { buscar });

  assert.equal(resultado.km, null);
  // E o motivo técnico chega junto: quem lê "chave não autorizada" sabe a quem
  // avisar; "não consegui calcular" não diz nada.
  assert.match(resultado.aviso, /REQUEST_DENIED|não autorizada|not authorized/i);
});

test('rede fora do ar não derruba a tela', async () => {
  const buscar = async () => {
    throw new Error('getaddrinfo ENOTFOUND maps.googleapis.com');
  };

  const resultado = await distancia('UHE São Manoel', { buscar });
  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /Google Maps/i);
});

// ---------------------------------------------------------------------------
// Sugestões enquanto se digita — Places Autocomplete (T134)
// ---------------------------------------------------------------------------

/** Resposta real da Autocomplete (New), reduzida aos campos que o adaptador lê. */
const SUGESTOES = {
  suggestions: [
    {
      placePrediction: {
        placeId: 'ChIJ-sede-itajai',
        text: { text: 'Rua Rosa Orsi Dalçoquio, 930 - Cordeiros, Itajaí - SC, Brasil' },
        structuredFormat: {
          mainText: { text: 'Rua Rosa Orsi Dalçoquio, 930' },
          secondaryText: { text: 'Cordeiros, Itajaí - SC, Brasil' }
        }
      }
    },
    {
      // Sem `structuredFormat` — acontece, e o adaptador não pode devolver linha
      // em branco por causa disso.
      placePrediction: {
        placeId: 'ChIJ-outra',
        text: { text: 'Rua Rosa Orsi Dalçoquio, 1200 - Itajaí - SC, Brasil' }
      }
    },
    // Sem `placeId` não serve para nada: escolher esta linha não daria origem.
    { placePrediction: { text: { text: 'lugar sem id' } } }
  ]
};

function autocompleteFalso(corpo = SUGESTOES) {
  const chamadas = [];
  const buscar = async (url, opcoes = {}) => {
    chamadas.push({ url: String(url), corpo: JSON.parse(opcoes.body), headers: opcoes.headers });
    return { ok: true, json: async () => corpo };
  };
  return { buscar, chamadas };
}

test('a sugestão devolve texto e placeId, e descarta o que não dá para escolher', async () => {
  const { buscar } = autocompleteFalso();
  const { items } = await sugerirEnderecos('Rua Rosa Orsi', { buscar });

  assert.equal(items.length, 2, 'a linha sem placeId entrou na lista');
  assert.equal(items[0].placeId, 'ChIJ-sede-itajai');
  assert.equal(items[0].principal, 'Rua Rosa Orsi Dalçoquio, 930');
  assert.equal(items[0].secundario, 'Cordeiros, Itajaí - SC, Brasil');
  // Sem `structuredFormat`, o texto inteiro vira o principal em vez de nada.
  assert.equal(items[1].principal, 'Rua Rosa Orsi Dalçoquio, 1200 - Itajaí - SC, Brasil');
});

test('TERMO CURTO NÃO GASTA CHAMADA — é uma por tecla digitada', async () => {
  // O risco desta função é justamente este: sem piso, um endereço digitado vira
  // 40 chamadas em vez de 4, e a franquia some sem ninguém notar.
  const { buscar, chamadas } = autocompleteFalso();

  for (const termo of ['', 'R', 'Ru', 'Rua']) {
    const { items } = await sugerirEnderecos(termo, { buscar });
    assert.deepEqual(items, []);
  }

  assert.equal(chamadas.length, 0);
});

test('a busca é limitada ao Brasil e pede só os campos que lê', async () => {
  const { buscar, chamadas } = autocompleteFalso();
  await sugerirEnderecos('Rua Rosa Orsi', { buscar });

  assert.deepEqual(chamadas[0].corpo.includedRegionCodes, ['br']);
  assert.equal(chamadas[0].corpo.languageCode, 'pt-BR');
  // Campo a mais na máscara pode subir o SKU da chamada.
  assert.doesNotMatch(chamadas[0].headers['X-Goog-FieldMask'], /addressComponents|location/);
});

test('a cota das sugestões é PRÓPRIA — não come a do cálculo de distância', async () => {
  // Teto de 3 sugestões neste arquivo, e 3 chamadas de distância. Se fossem o
  // mesmo contador, o autocompletar deixaria o cálculo sem franquia.
  const { buscar } = autocompleteFalso();
  for (let i = 0; i < 3; i += 1) await sugerirEnderecos(`Rua Rosa Orsi ${i}`, { buscar });

  const estourada = await sugerirEnderecos('Rua Rosa Orsi 4', { buscar });
  assert.deepEqual(estourada.items, []);
  assert.match(estourada.aviso, /Limite diário de sugestões/i);

  // E a distância continua funcionando, com a cota dela intacta.
  const { buscar: buscarRota } = googleFalso();
  const distanciaAinda = await distanciaAteObra('UHE São Manoel', { buscar: buscarRota, sede: SEDE });
  assert.equal(distanciaAinda.km, 2706);
});

test('Places API desabilitada vira aviso, não tela quebrada', async () => {
  // É o erro esperado no primeiro deploy: a Places API (New) é outra API do
  // console, e não vem habilitada com a Geocoding e a Routes.
  const buscar = async () => ({
    ok: true,
    json: async () => ({
      error: { message: 'Places API (New) has not been used in project 123 before or it is disabled' }
    })
  });

  const { items, aviso } = await sugerirEnderecos('Rua Rosa Orsi', { buscar });

  assert.deepEqual(items, []);
  assert.match(aviso, /Places API/i);
});

test('rede fora do ar não derruba o campo', async () => {
  const buscar = async () => {
    throw new Error('getaddrinfo ENOTFOUND places.googleapis.com');
  };

  const { items, aviso } = await sugerirEnderecos('Rua Rosa Orsi', { buscar });
  assert.deepEqual(items, []);
  assert.ok(aviso);
});
