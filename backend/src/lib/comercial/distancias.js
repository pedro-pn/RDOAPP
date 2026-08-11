import env from '../../config/env.js';
import { ComercialError } from './cost-estimates.js';

/**
 * Distância sede → obra, calculada (tarefa T126a).
 *
 * Dois serviços do Google, ambos no tier **Essentials**, com 10.000 chamadas
 * gratuitas por mês **cada**:
 *
 *   Geocoding  endereço digitado → endereço oficial + coordenada + `partial_match`
 *   Routes     distância rodoviária da sede até lá
 *
 * A Geocoding não é redundante. A Routes resolve o endereço sozinha — inclusive
 * nome de usina — mas devolve só `placeId` e `type`, **nunca o endereço
 * formatado**. Sem ela, dá para calcular e não dá para mostrar o que foi
 * encontrado. E é justamente aí que mora o defeito perigoso:
 *
 * > "Unidade de Cubatão" **não acha a unidade — acha a cidade**, e devolve
 * > 595 km como se fosse resposta. Ninguém olhando o campo desconfia.
 *
 * Trocar campo em branco por número errado é pior que deixar em branco: o branco
 * alguém preenche, o número ninguém confere. Por isso o resultado sempre vem com
 * **o endereço encontrado e um nível de confiança**, e a tela decide se pede
 * confirmação.
 *
 * Três modos, como Nectar e SharePoint, e `off` continua sendo o padrão.
 */

const GEOCODING = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const TEMPO_LIMITE_MS = 8000;

/**
 * Tipos que significam "achei a região, não o lugar".
 *
 * Chegar num deles é o caso da "Unidade de Cubatão": a resposta existe, a
 * distância é plausível, e o destino está errado.
 */
const SO_REGIAO = new Set([
  'locality',
  'political',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'country',
  'postal_code'
]);

export class DistanciaError extends ComercialError {
  constructor(message, statusCode = 502) {
    super(message, statusCode);
    this.name = 'DistanciaError';
  }
}

export function modoDasDistancias() {
  return env.mapsMode;
}

/** Recusa antes de gastar chamada. Devolve o motivo, como os outros adaptadores. */
export function indisponivel() {
  const modo = modoDasDistancias();
  if (modo === 'off') {
    return 'O cálculo automático de distância está desligado neste ambiente.';
  }
  if (modo === 'real' && !env.mapsApiKey) {
    return 'A chave do Google Maps não está configurada (GOOGLE_MAPS_API_KEY).';
  }
  if (!env.comercialSedeEndereco) {
    return 'O endereço da sede não está configurado (COMERCIAL_SEDE_ENDERECO).';
  }
  return '';
}

/**
 * Cache por endereço normalizado, em memória.
 *
 * Vive no processo e morre no restart, de propósito: a distância calculada é
 * **gravada no levantamento**, então ela não é recalculada a cada abertura — o
 * cache serve para a mesma obra consultada várias vezes na mesma sessão de
 * trabalho. Uma tabela no banco resolveria mais, e não paga o custo de uma
 * migration para economizar dezenas de chamadas numa franquia de 10.000.
 */
const cache = new Map();
const CACHE_MAXIMO = 500;

/** Contador da cota diária. Reinicia sozinho na virada do dia. */
const cota = { dia: '', usadas: 0 };

export function chaveDeCache(endereco) {
  return String(endereco || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * A cota de segurança existe porque a franquia é generosa e invisível.
 *
 * Um defeito que dispare chamadas em laço passa das 10.000 do mês sem ninguém
 * notar — e só aparece na fatura. O teto diário transforma isso num campo que
 * pede para ser digitado, que é o comportamento de hoje.
 */
function consumirCota() {
  const hoje = new Date().toISOString().slice(0, 10);
  if (cota.dia !== hoje) {
    cota.dia = hoje;
    cota.usadas = 0;
  }
  if (cota.usadas >= env.mapsMaxDia) {
    throw new DistanciaError(
      `Limite diário de consultas de distância atingido (${env.mapsMaxDia}). Informe a distância manualmente.`,
      429
    );
  }
  cota.usadas += 1;
}

export function cotaUsada() {
  return { dia: cota.dia, usadas: cota.usadas, teto: env.mapsMaxDia };
}

/**
 * Calcula a distância da sede até o endereço.
 *
 * Devolve sempre `{ km, enderecoEncontrado, confianca, aviso }`, e **nunca
 * lança**. Endereço não encontrado, serviço fora do ar, chave sem permissão e
 * cota estourada são todos a mesma coisa do ponto de vista de quem está na tela:
 * o campo continua editável, e ele digita. Um erro subindo daqui faria a tela
 * parecer quebrada quando o trabalho pode seguir.
 *
 * O motivo vem no `aviso` — inclusive o técnico, porque quem lê "chave não
 * autorizada" sabe a quem avisar, e "não consegui calcular" não diz nada.
 */
export async function distanciaAteObra(endereco, opcoes = {}) {
  try {
    return await calcular(endereco, opcoes);
  } catch (error) {
    return naoEncontrado(
      error instanceof DistanciaError
        ? error.message
        : `Não foi possível calcular a distância: ${error.message}`
    );
  }
}

async function calcular(endereco, { buscar = fetch } = {}) {
  const consulta = String(endereco || '').trim();
  if (!consulta) {
    return naoEncontrado('Informe o endereço da obra para calcular a distância.');
  }

  const impedimento = indisponivel();
  if (impedimento) return naoEncontrado(impedimento);

  const chave = chaveDeCache(consulta);
  if (cache.has(chave)) return cache.get(chave);

  if (modoDasDistancias() === 'fake') {
    return guardar(chave, {
      km: 100,
      enderecoEncontrado: `${consulta} (modo de teste)`,
      confianca: 'exata',
      aviso: ''
    });
  }

  const local = await geocodificar(consulta, buscar);
  if (!local) {
    return naoEncontrado(`Não encontrei "${consulta}". Confira o endereço ou informe a distância.`);
  }

  const km = await distanciaRodoviaria(local, buscar);
  if (km === null) {
    return naoEncontrado(
      `Encontrei "${local.endereco}", mas não há rota rodoviária a partir da sede.`
    );
  }

  return guardar(chave, {
    km,
    enderecoEncontrado: local.endereco,
    confianca: local.confianca,
    aviso: local.aviso
  });
}

function naoEncontrado(aviso) {
  return { km: null, enderecoEncontrado: '', confianca: 'nenhuma', aviso };
}

function guardar(chave, resultado) {
  // Cache sem teto vira vazamento de memória num processo de vida longa.
  if (cache.size >= CACHE_MAXIMO) cache.delete(cache.keys().next().value);
  cache.set(chave, resultado);
  return resultado;
}

/**
 * Endereço digitado → endereço oficial, com o **nível de confiança**.
 *
 * Os dois sinais vêm de graça na resposta e dizem coisas diferentes:
 *
 * - `partial_match` — o Google não casou tudo o que foi digitado;
 * - `types` só de região — casou, mas o que existe é a cidade.
 *
 * "Unidade de Cubatão" dispara os dois. "Cubatão" sozinho dispara só o segundo,
 * e é resposta correta para quem quis a cidade — por isso os avisos são
 * diferentes.
 */
async function geocodificar(endereco, buscar) {
  const url = new URL(GEOCODING);
  url.searchParams.set('address', endereco);
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('key', env.mapsApiKey);

  consumirCota();
  const resposta = await chamar(buscar, url.toString());
  const corpo = await resposta.json();

  if (corpo.status === 'ZERO_RESULTS') return null;
  if (corpo.status !== 'OK') {
    throw new DistanciaError(
      `O Google não respondeu à consulta de endereço: ${corpo.status}${corpo.error_message ? ` — ${corpo.error_message}` : ''}.`
    );
  }

  const primeiro = corpo.results[0];
  const tipos = primeiro.types || [];
  const soRegiao = tipos.length > 0 && tipos.every(tipo => SO_REGIAO.has(tipo));

  let confianca = 'exata';
  let aviso = '';

  if (primeiro.partial_match) {
    confianca = 'parcial';
    aviso = `Não achei exatamente o que foi digitado. Usei "${primeiro.formatted_address}" — confira antes de seguir.`;
  } else if (soRegiao) {
    confianca = 'regiao';
    aviso = `Achei apenas a cidade (${primeiro.formatted_address}), não o endereço da obra. A distância é até o centro dela.`;
  }

  return {
    endereco: primeiro.formatted_address,
    placeId: primeiro.place_id,
    confianca,
    aviso
  };
}

/**
 * A distância rodoviária, pelo `placeId` que a geocodificação já resolveu.
 *
 * Mandar o `placeId` em vez do texto evita que a Routes resolva o endereço de
 * novo — por conta própria, e possivelmente para outro lugar que o que a tela
 * acabou de mostrar ao usuário.
 */
async function distanciaRodoviaria(local, buscar) {
  consumirCota();

  const resposta = await chamar(buscar, ROUTES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.mapsApiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters'
    },
    body: JSON.stringify({
      origin: { address: env.comercialSedeEndereco },
      destination: { placeId: local.placeId },
      travelMode: 'DRIVE',
      languageCode: 'pt-BR',
      regionCode: 'BR'
    })
  });

  const corpo = await resposta.json();
  if (corpo.error) {
    throw new DistanciaError(`O Google recusou o cálculo de rota: ${corpo.error.message}.`);
  }

  const metros = corpo.routes?.[0]?.distanceMeters;
  if (!metros) return null;

  // Arredondado ao quilômetro: o campo é em km inteiros, e casa decimal em
  // 2.706 km é precisão que a rota não tem.
  return Math.round(metros / 1000);
}

async function chamar(buscar, url, opcoes = {}) {
  const resposta = await buscar(url, {
    ...opcoes,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
  }).catch(erro => {
    throw new DistanciaError(`Não foi possível falar com o Google Maps: ${erro.message}`);
  });

  if (!resposta.ok) {
    throw new DistanciaError(`O Google Maps respondeu com erro ${resposta.status}.`);
  }
  return resposta;
}

/** Só para o teste: a memória entre casos não pode vazar de um para o outro. */
export function limparCache() {
  cache.clear();
  cota.dia = '';
  cota.usadas = 0;
}
