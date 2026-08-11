import env from '../../config/env.js';
import { ComercialError } from './cost-estimates.js';

/**
 * Adaptador do SharePoint / OneDrive, via Microsoft Graph (tarefas T076 e T076f).
 *
 * Mesmos três modos do Nectar, e pela mesma razão: **não há ambiente de teste
 * separado**. O destino é a biblioteca de documentos real da empresa, e um
 * ambiente mal configurado que "tentasse por padrão" criaria pasta de verdade
 * dentro dela.
 *
 *   off    não tenta. A finalização responde que o envio está desligado.
 *   fake   responde como se tivesse gravado, sem rede. É o modo do dev e da suíte.
 *   real   autentica com as credenciais do aplicativo e grava.
 *
 * A contenção que não depende da Microsoft é `SHAREPOINT_BASE_FOLDER`: tudo é
 * criado **dentro** dela. Apontar o ambiente de teste para uma pasta de testes
 * mantém o erro de código longe de "02 - Comercial/Projetos em cotação".
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LOGIN = 'https://login.microsoftonline.com';
const TEMPO_LIMITE_MS = 15000;

export class SharePointError extends ComercialError {
  constructor(message, statusCode = 502) {
    super(message, statusCode);
    this.name = 'SharePointError';
  }
}

export function modoDoSharePoint() {
  return env.sharepointMode;
}

/**
 * Recusa antes de qualquer trabalho quando o envio não pode acontecer.
 *
 * Devolve o motivo em vez de lançar, como o Nectar: quem chama precisa
 * continuar, porque os documentos já existem e continuam baixáveis (FR-034).
 */
export function indisponivel() {
  const modo = modoDoSharePoint();
  if (modo === 'off') {
    return 'O envio ao SharePoint está desligado neste ambiente (SHAREPOINT_MODE=off).';
  }
  if (modo !== 'real') return '';

  const faltando = [
    ['MICROSOFT_TENANT_ID', env.microsoftTenantId],
    ['MICROSOFT_CLIENT_ID', env.microsoftClientId],
    ['MICROSOFT_CLIENT_SECRET', env.microsoftClientSecret],
    ['SHAREPOINT_HOSTNAME', env.sharepointHostname],
    ['SHAREPOINT_SITE_PATH', env.sharepointSitePath]
  ]
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);

  return faltando.length
    ? `Integração Microsoft pendente: ${faltando.join(', ')} não configurado(s).`
    : '';
}

/**
 * Grava os arquivos numa pasta da proposta e devolve o caminho gravado.
 *
 * `pastaExistente` é o `PROP-CTL-080` (T076f): havendo valor, os arquivos vão
 * **para dentro dela** em vez de uma pasta nova. É o caso de a obra já ter uma
 * pasta no OneDrive — criar outra ao lado espalharia os documentos da mesma
 * negociação por dois lugares.
 */
export async function gravarArquivos(arquivos, { nomeDaPasta, pastaExistente = '' } = {}) {
  const pasta = nomeDeePasta(pastaExistente || nomeDaPasta);
  const destino = `${env.sharepointBaseFolder}/${pasta}`.replace(/^\/+|\/+$/g, '');

  if (modoDoSharePoint() === 'fake') {
    return { pasta: destino, arquivos: arquivos.length };
  }

  const cabecalhos = { Authorization: `Bearer ${await autenticar()}` };
  const driveId = await acharBiblioteca(cabecalhos);

  await garantirPastas(driveId, destino, cabecalhos);

  // Um por vez, e não em paralelo: o Graph limita requisições por aplicativo, e
  // três uploads simultâneos de PDF grande são o caminho mais curto para o 429.
  for (const arquivo of arquivos) {
    await enviarArquivo(driveId, destino, arquivo, cabecalhos);
  }

  return { pasta: destino, arquivos: arquivos.length };
}

// ---------------------------------------------------------------------------

async function autenticar() {
  const resposta = await chamar(`${LOGIN}/${env.microsoftTenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.microsoftClientId,
      client_secret: env.microsoftClientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default'
    })
  });

  if (!resposta.ok) {
    throw new SharePointError('Não foi possível autenticar o serviço no Microsoft 365.');
  }

  const token = String((await resposta.json()).access_token || '');
  if (!token) {
    throw new SharePointError('O Microsoft 365 autenticou sem devolver o token.');
  }
  return token;
}

async function acharBiblioteca(cabecalhos) {
  const site = await chamar(
    `${GRAPH}/sites/${env.sharepointHostname}:${caminhoDeUrl(env.sharepointSitePath)}`,
    { headers: cabecalhos }
  );
  if (!site.ok) {
    throw new SharePointError(
      `O site ${env.sharepointSitePath} não foi localizado no SharePoint.`
    );
  }

  const siteId = String((await site.json()).id || '');
  const drive = await chamar(`${GRAPH}/sites/${siteId}/drive`, { headers: cabecalhos });
  if (!drive.ok) {
    throw new SharePointError('A biblioteca de documentos do site não foi localizada.');
  }

  return String((await drive.json()).id || '');
}

/**
 * Cria a árvore de pastas, um nível por vez.
 *
 * O Graph não cria caminho intermediário sozinho: pedir `a/b/c` de uma vez
 * falha se `a/b` não existir. E cada nível é **procurado antes de criar**, senão
 * a segunda proposta do mesmo mês esbarraria numa pasta que já existe.
 */
async function garantirPastas(driveId, caminho, cabecalhos) {
  let pai = 'root';

  for (const nome of caminho.split('/').filter(Boolean)) {
    const alvo =
      pai === 'root'
        ? `${GRAPH}/drives/${driveId}/root:/${encodeURIComponent(nome)}`
        : `${GRAPH}/drives/${driveId}/items/${pai}:/${encodeURIComponent(nome)}`;

    const existente = await chamar(alvo, { headers: cabecalhos });
    if (existente.ok) {
      pai = String((await existente.json()).id || '');
      continue;
    }

    const filhos = pai === 'root' ? 'root/children' : `items/${pai}/children`;
    const criada = await chamar(`${GRAPH}/drives/${driveId}/${filhos}`, {
      method: 'POST',
      headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome,
        folder: {},
        // `fail` de propósito: se apareceu entre a procura e a criação, é outra
        // finalização acontecendo ao mesmo tempo — e renomear para "pasta 1"
        // espalharia os documentos da mesma proposta.
        '@microsoft.graph.conflictBehavior': 'fail'
      })
    });

    if (!criada.ok) {
      throw new SharePointError(`Não foi possível criar a pasta ${nome} no SharePoint.`);
    }
    pai = String((await criada.json()).id || '');
  }
}

async function enviarArquivo(driveId, pasta, arquivo, cabecalhos) {
  const caminho = `${pasta}/${nomeDeArquivo(arquivo.fileName)}`
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const resposta = await chamar(`${GRAPH}/drives/${driveId}/root:/${caminho}:/content`, {
    method: 'PUT',
    headers: { ...cabecalhos, 'Content-Type': tipoDe(arquivo.fileName) },
    body: arquivo.bytes
  });

  if (!resposta.ok) {
    throw new SharePointError(`Não foi possível salvar ${arquivo.fileName} no SharePoint.`);
  }
}

async function chamar(url, opcoes = {}) {
  return fetch(url, { ...opcoes, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) }).catch(erro => {
    throw new SharePointError(`Não foi possível falar com o Microsoft 365: ${erro.message}`);
  });
}

/**
 * O caminho do site vira segmento de URL do Graph, com as barras preservadas.
 *
 * `encodeURIComponent` no caminho inteiro comeria as barras e o site não seria
 * encontrado; codificar segmento a segmento mantém a estrutura.
 */
export function caminhoDeUrl(caminho) {
  const limpo = String(caminho || '').replace(/^\/+|\/+$/g, '');
  if (!limpo) return ':';
  return `:/${limpo.split('/').map(encodeURIComponent).join('/')}:`;
}

/**
 * Nome de pasta aceito pelo SharePoint.
 *
 * Ele recusa `\ : * ? " < > |` e nome terminado em ponto — e a recusa vem
 * depois do upload começar, com mensagem que não diz qual caractere. Limpar
 * antes é mais barato que interpretar o erro.
 */
/** Um segmento limpo, sem o que o SharePoint recusa. Pode voltar vazio. */
function limparSegmento(valor) {
  return String(valor)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')
    .trim();
}

export function nomeDeePasta(valor) {
  return (
    String(valor || '')
      .split('/')
      .map(limparSegmento)
      .filter(Boolean)
      .join('/') || 'Proposta'
  );
}

/**
 * Nome de arquivo, com reserva **própria**.
 *
 * Ele não passa por `nomeDeePasta`: aquela tem a reserva "Proposta", que é nome
 * de pasta e nunca de arquivo — um anexo sem nome viraria "Proposta", sem
 * extensão, ao lado da proposta de verdade.
 *
 * E a barra vira hífen antes de tudo: `Proposta 4418/2.pdf` criaria a pasta
 * "Proposta 4418" com "2.pdf" dentro, em silêncio.
 */
export function nomeDeArquivo(valor) {
  return limparSegmento(String(valor || '').replace(/\//g, '-')) || 'arquivo';
}

function tipoDe(nome) {
  if (/\.pdf$/i.test(nome)) return 'application/pdf';
  if (/\.csv$/i.test(nome)) return 'text/csv';
  return 'application/octet-stream';
}
