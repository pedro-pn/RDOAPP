import env from '../../config/env.js';
import { ComercialError } from './cost-estimates.js';

/**
 * Busca de empresa e contato no CRM (tarefas T121 e T123).
 *
 * No Nectar **não existe cadastro separado de empresa**: empresa é um `contato`
 * com `isEmpresa: true`, e as pessoas ficam aninhadas nele. O endpoint
 * `/empresas` **não existe** — devolve 404 em HTML, que é o que se ganha ao
 * chutar rota em vez de ler a referência.
 *
 * **Duas limitações da API definem este arquivo, e as duas foram medidas:**
 *
 * 1. **O filtro `nome` casa só por PREFIXO.** `nome=petro` acha "PETROLEO
 *    BRASILEIRO S A PETROBRAS"; `nome=petrobras` acha **zero**. É a queixa do
 *    comercial, não tem conserto por parâmetro, e é o motivo do índice local.
 * 2. **Há limite de taxa.** Nove páginas seguidas de 100 registros levaram 35 s
 *    e a décima voltou **429**. Varrer o cadastro a cada busca é impossível.
 *
 * **A busca por trecho ainda NÃO está resolvida, e isto está desligado por
 * padrão.** O plano era montar um índice em memória varrendo `/contatos`. Medido
 * contra o cadastro real, não funciona:
 *
 *     1.500 contatos lidos em 15 páginas  ->  53 empresas, e a PETROBRAS não
 *     está entre elas. A base é maior, as empresas são ~3,5% e estão espalhadas
 *     (uma página trouxe 42, sete trouxeram zero).
 *
 * E não há como pedir só as empresas: `isEmpresa=true`, `tipo=empresa` e as
 * outras variantes são **ignoradas** pela API — devolvem a mesma página de
 * sempre. Varrer tudo a cada 30 minutos, a 1,5 s por página e sob limite de
 * taxa, não é caminho.
 *
 * Índice parcial é **pior que índice nenhum**: ele responde "não achei" com a
 * mesma cara de "não existe", e quem procura conclui que a empresa não está no
 * CRM. Por isso `INDICE_LIGADO` é `false`, e `porTrechoDisponivel` responde a
 * verdade.
 *
 * O caminho é espelho **persistido**, sincronizado por job — está na T123.
 */

/** Ver o bloco acima: o índice em memória não dá conta do cadastro real. */
const INDICE_LIGADO = false;

const BASE = 'https://app.nectarcrm.com.br/crm/api/1';
const TEMPO_LIMITE_MS = 20000;
const POR_PAGINA = 100;

/** Entre páginas, para não levar 429 — medido: 9 páginas rápidas já bastam. */
const PAUSA_ENTRE_PAGINAS_MS = 1500;
const MAXIMO_DE_PAGINAS = 40;
const VALIDADE_DO_INDICE_MS = 30 * 60 * 1000;

export class CrmError extends ComercialError {
  constructor(message, statusCode = 502) {
    super(message, statusCode);
    this.name = 'CrmError';
  }
}

const indice = { empresas: [], construidoEm: 0, construindo: null };

export function indisponivel() {
  if (env.nectarMode === 'off') {
    return 'A busca no CRM está desligada neste ambiente (NECTAR_MODE=off).';
  }
  if (env.nectarMode === 'real' && !env.nectarApiToken) {
    return 'O token do Nectar não está configurado (NECTAR_API_TOKEN).';
  }
  return '';
}

/**
 * Normaliza para comparar: sem acento, sem pontuação, minúsculo.
 *
 * "S/A", "S.A." e "SA" têm de casar, e "Petrobrás" tem de achar "PETROBRAS" —
 * quem digita não sabe como o cadastro foi escrito.
 */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Uma empresa, no formato que a tela consome.
 *
 * O CNPJ vem **como está no CRM**, inclusive vazio. Empresa sem CNPJ não é
 * escondida: ela existe, o vendedor pode escolhê-la e digitar o CNPJ na etapa 1,
 * que é obrigatório lá. Filtrá-la aqui — como a referência fazia, exigindo 14
 * dígitos — esconderia cadastro legítimo sem dizer por quê.
 */
export function comoEmpresa(registro) {
  const enderecos = Array.isArray(registro.enderecos) ? registro.enderecos : [];
  const endereco = enderecos.find(item => item?.principal) ?? enderecos[0] ?? {};

  const rua = [endereco.logradouro, endereco.numero, endereco.bairro].filter(Boolean).join(', ');
  const cidade = [endereco.municipio, endereco.estado].filter(Boolean).join('/');

  return {
    id: String(registro.id ?? ''),
    nome: String(registro.nome ?? registro.razaoSocial ?? 'Sem nome'),
    cnpj: String(registro.cnpj ?? ''),
    site: [rua, cidade].filter(Boolean).join(' — '),
    contatos: (Array.isArray(registro.contatos) ? registro.contatos : []).map(comoPessoa)
  };
}

export function comoPessoa(registro) {
  const emails = Array.isArray(registro.emails) ? registro.emails : [];
  const primeiro = emails.find(item => typeof item === 'string') ?? emails[0];

  return {
    id: String(registro.id ?? ''),
    nome: String(registro.nome ?? 'Sem nome'),
    email: String(typeof primeiro === 'string' ? primeiro : primeiro?.email ?? registro.email ?? ''),
    departamento: String(registro.cargo ?? registro.departamento ?? '')
  };
}

/** Empresa é `contato` com `isEmpresa: true`. */
function ehEmpresa(registro) {
  return registro?.isEmpresa === true;
}

async function chamar(caminho, buscar) {
  const resposta = await buscar(`${BASE}${caminho}`, {
    headers: { 'Access-Token': env.nectarApiToken },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
  }).catch(erro => {
    throw new CrmError(`Não foi possível falar com o Nectar: ${erro.message}`);
  });

  if (resposta.status === 429) {
    throw new CrmError('O Nectar limitou as consultas por excesso de pedidos. Tente em instantes.', 429);
  }
  if (!resposta.ok) {
    throw new CrmError(`O Nectar respondeu com erro ${resposta.status}.`);
  }

  const corpo = await resposta.json();
  return Array.isArray(corpo) ? corpo : corpo?.data ?? corpo?.items ?? [];
}

/**
 * Busca por PREFIXO, direto na API. Uma requisição, resposta imediata.
 */
async function porPrefixo(termo, buscar) {
  const registros = await chamar(
    `/contatos?nome=${encodeURIComponent(termo)}&displayLength=25`,
    buscar
  );
  return registros.filter(ehEmpresa).map(comoEmpresa);
}

/**
 * Constrói o índice de empresas, paginando **com pausa**.
 *
 * A pausa não é excesso de zelo: nove páginas seguidas levaram a 429 na décima.
 * Sem ela, o índice se auto-sabota e ainda deixa o CRM irritado com o resto do
 * app.
 *
 * Uma construção por vez — `indice.construindo` guarda a promessa, e duas buscas
 * simultâneas com o índice frio esperam a mesma varredura em vez de dispararem
 * duas.
 */
async function construirIndice(buscar, dormir) {
  if (indice.construindo) return indice.construindo;

  indice.construindo = (async () => {
    const empresas = new Map();

    try {
      for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina += 1) {
        const registros = await chamar(
          `/contatos?page=${pagina}&displayLength=${POR_PAGINA}`,
          buscar
        );

        for (const registro of registros.filter(ehEmpresa)) {
          empresas.set(String(registro.id), comoEmpresa(registro));
        }

        if (registros.length < POR_PAGINA) break;
        await dormir(PAUSA_ENTRE_PAGINAS_MS);
      }

      indice.empresas = [...empresas.values()];
      indice.construidoEm = Date.now();
    } finally {
      indice.construindo = null;
    }

    return indice.empresas;
  })();

  return indice.construindo;
}

function indiceValido() {
  return indice.construidoEm > 0 && Date.now() - indice.construidoEm < VALIDADE_DO_INDICE_MS;
}

/**
 * Busca empresas por prefixo **e** por trecho.
 *
 * O prefixo sai na hora. O trecho depende do índice: quente, entra junto;
 * frio, a resposta avisa que está sendo montado — e **não trava a tela**, porque
 * o resultado do prefixo já serve para a maioria dos casos.
 */
export async function buscarEmpresas(termo, opcoes = {}) {
  const { buscar = fetch, dormir = ms => new Promise(r => setTimeout(r, ms)), esperarIndice = false } = opcoes;

  const consulta = String(termo || '').trim();
  if (consulta.length < 2) {
    throw new ComercialError('Digite ao menos 2 caracteres para buscar.', 400);
  }

  const impedimento = indisponivel();
  if (impedimento) throw new CrmError(impedimento, 503);

  const daApi = await porPrefixo(consulta, buscar);

  let doIndice = [];
  let indiceEmPreparo = false;

  if (!INDICE_LIGADO && !esperarIndice) {
    // Sem índice, a resposta diz que a busca por trecho não vale — e a tela
    // avisa em vez de deixar o usuário concluir que a empresa não existe.
    return { items: daApi, porTrechoDisponivel: false, indiceEmPreparo: false };
  }

  if (indiceValido()) {
    doIndice = filtrarPorTrecho(indice.empresas, consulta);
  } else if (esperarIndice) {
    doIndice = filtrarPorTrecho(await construirIndice(buscar, dormir), consulta);
  } else {
    // Dispara e segue: quem buscar daqui a pouco pega o índice pronto. O erro é
    // engolido de propósito — falha de índice não pode derrubar uma busca que já
    // tem resposta pelo prefixo.
    indiceEmPreparo = true;
    construirIndice(buscar, dormir).catch(() => {});
  }

  const juntas = new Map();
  for (const empresa of [...daApi, ...doIndice]) juntas.set(empresa.id, empresa);

  return {
    items: [...juntas.values()],
    porTrechoDisponivel: indiceValido(),
    indiceEmPreparo
  };
}

export function filtrarPorTrecho(empresas, termo) {
  const alvo = normalizar(termo);
  if (!alvo) return [];
  return empresas.filter(
    empresa => normalizar(empresa.nome).includes(alvo) || empresa.cnpj.replace(/\D/g, '').includes(alvo)
  );
}

/** A empresa com as pessoas dela, para a tela preencher contato e e-mail. */
export async function empresaComContatos(id, opcoes = {}) {
  const { buscar = fetch } = opcoes;

  const impedimento = indisponivel();
  if (impedimento) throw new CrmError(impedimento, 503);

  const registros = await chamar(`/contatos/${encodeURIComponent(id)}`, buscar);
  const registro = Array.isArray(registros) ? registros[0] : registros;
  if (!registro) throw new CrmError('Empresa não encontrada no Nectar.', 404);

  return comoEmpresa(registro);
}

/** Só para o teste: o índice não pode vazar de um caso para o outro. */
export function limparIndice() {
  indice.empresas = [];
  indice.construidoEm = 0;
  indice.construindo = null;
}
