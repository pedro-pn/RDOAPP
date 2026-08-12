import { ComercialError } from './cost-estimates.js';
import { distanciaAteObra, localizarEndereco } from './distancias.js';

/**
 * Configuração do módulo Comercial, editável por gestor (T131).
 *
 * Hoje guarda uma coisa só — o endereço da sede —, e ela chegou aqui vinda do
 * `.env`. O motivo da mudança, decidido pelo mantenedor em 12/08:
 *
 * > O endereço da sede é **dado de negócio**. Muda quando a empresa muda de
 * > prédio, quem sabe o endereço novo é o gestor, e até aqui trocá-lo exigia
 * > editar arquivo no servidor e reiniciar o container.
 *
 * A variável `COMERCIAL_SEDE_ENDERECO` deixou de existir junto — não ficou como
 * fallback. Duas fontes para o mesmo dado é a receita para o servidor calcular
 * distância a partir de um endereço que a tela de configuração nega estar
 * usando, e ninguém entender por quê.
 *
 * ---------------------------------------------------------------------------
 * Por que o `placeId` é gravado junto
 *
 * Salvar só o texto faria a Google resolver o endereço **a cada cálculo de
 * rota**, por conta própria. É o mesmo defeito que o cálculo da obra já trata
 * ("Unidade de Cubatão" vira a cidade de Cubatão), só que do lado da origem —
 * onde ninguém olharia, porque a tela mostra o destino. Com o `placeId`
 * resolvido uma vez, na hora de salvar, a origem da rota é a que o gestor
 * confirmou na tela.
 *
 * Guardar o `placeId` não impede de salvar sem ele: se o Maps estiver desligado
 * ou não achar o endereço, o texto é gravado do mesmo jeito e a rota volta a
 * usá-lo. O gestor decide — o aviso vai junto na resposta.
 */

const SINGLETON = 'singleton';

/** Endereço mais curto que isso é engano de digitação, não endereço. */
const MINIMO = 8;
const MAXIMO = 300;

export class ConfiguracaoError extends ComercialError {
  constructor(message, statusCode = 400) {
    super(message, statusCode);
    this.name = 'ConfiguracaoError';
  }
}

/**
 * A configuração como está gravada.
 *
 * **Nunca devolve `null`.** Antes de alguém salvar pela primeira vez a linha não
 * existe, e o estado certo é "sede em branco" — que a tela já sabe apresentar —,
 * não um erro. Ler não cria a linha: uma leitura que escreve transforma abrir a
 * tela em escrita no banco.
 */
export async function lerConfiguracao(prismaClient) {
  const linha = await prismaClient.comercialSettings.findUnique({ where: { id: SINGLETON } });
  return apresentar(linha);
}

/**
 * A origem das rotas, no formato que o cálculo de distância consome.
 *
 * Sem cache de propósito. A leitura é uma linha por `id`, e o cálculo que vem
 * depois faz duas chamadas HTTP — o custo aqui é ruído. Um cache em memória, num
 * deploy com mais de um processo, guardaria o endereço antigo em uns e o novo em
 * outros, e o sintoma seria distância que muda conforme a requisição cai.
 */
export async function enderecoDaSede(prismaClient) {
  const { sedeEndereco, sedePlaceId } = await lerConfiguracao(prismaClient);
  return { endereco: sedeEndereco, placeId: sedePlaceId };
}

/**
 * Distância da sede configurada até a obra.
 *
 * É a única porta pela qual as rotas do módulo pedem distância. Existe para que
 * ninguém precise lembrar de ler a sede antes de calcular: esquecer o `sede`
 * daria "sede não configurada" numa instalação em que ela está configuradíssima,
 * e o erro apareceria como problema de configuração do cliente.
 */
export async function distanciaDaSede(prismaClient, endereco, opcoes = {}) {
  const sede = await enderecoDaSede(prismaClient);
  return distanciaAteObra(endereco, { ...opcoes, sede });
}

/**
 * Grava o endereço da sede.
 *
 * `localizar` é o que dá o `placeId` e o endereço oficial. Quando o Maps está
 * desligado ou não encontra, **grava mesmo assim** e devolve o aviso: o endereço
 * digitado continua servindo de origem, e recusar a gravação deixaria o gestor
 * sem como configurar um ambiente onde o Maps está off — que é o padrão.
 */
export async function salvarSede(prismaClient, usuario, dados, opcoes = {}) {
  const endereco = normalizarEndereco(dados?.sedeEndereco);
  const local = await localizarEndereco(endereco, opcoes);

  const linha = await prismaClient.comercialSettings.upsert({
    where: { id: SINGLETON },
    create: {
      id: SINGLETON,
      sedeAddress: endereco,
      sedeFormattedAddress: local.enderecoEncontrado || null,
      sedePlaceId: local.placeId || null,
      updatedByUserId: usuario?.id || null,
      updatedByLabel: rotulo(usuario)
    },
    update: {
      sedeAddress: endereco,
      // O que não foi encontrado agora é apagado, não mantido: guardar o
      // `placeId` do endereço ANTERIOR mandaria a rota sair do prédio velho
      // enquanto a tela mostra o novo.
      sedeFormattedAddress: local.enderecoEncontrado || null,
      sedePlaceId: local.placeId || null,
      updatedByUserId: usuario?.id || null,
      updatedByLabel: rotulo(usuario)
    }
  });

  return { ...apresentar(linha), aviso: local.aviso, confianca: local.confianca };
}

/**
 * Localiza um endereço sem gravar nada — o botão "localizar" da tela.
 *
 * Existe para o gestor conferir ANTES de salvar. `localizarEndereco` nunca
 * lança, então o resultado é sempre exibível: achou, achou parcialmente, ou não
 * achou e o motivo.
 */
export async function conferirEndereco(endereco, opcoes = {}) {
  return localizarEndereco(normalizarEndereco(endereco), opcoes);
}

function normalizarEndereco(valor) {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();

  if (!texto) {
    throw new ConfiguracaoError('Informe o endereço da sede.');
  }
  if (texto.length < MINIMO) {
    throw new ConfiguracaoError('O endereço da sede está curto demais para ser encontrado.');
  }
  if (texto.length > MAXIMO) {
    throw new ConfiguracaoError(`O endereço da sede passa de ${MAXIMO} caracteres.`);
  }
  return texto;
}

function rotulo(usuario) {
  return usuario?.name || usuario?.username || null;
}

function apresentar(linha) {
  return {
    sedeEndereco: linha?.sedeAddress || '',
    sedeEnderecoEncontrado: linha?.sedeFormattedAddress || '',
    sedePlaceId: linha?.sedePlaceId || '',
    atualizadoEm: linha?.updatedAt ? linha.updatedAt.toISOString() : null,
    atualizadoPor: linha?.updatedByLabel || ''
  };
}
