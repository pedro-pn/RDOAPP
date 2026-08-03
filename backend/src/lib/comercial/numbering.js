import { ComercialError } from './cost-estimates.js';

/**
 * Numeração das propostas do módulo Comercial.
 *
 * O número emitido aqui vira o código do levantamento, da proposta técnica e da
 * comercial — e vai impresso no documento que chega ao cliente. Repetir um número
 * significa dois clientes com a mesma proposta na mão.
 *
 * Por isso a sequence nasce **não semeada**. O valor de partida depende do maior
 * número já usado no CRM Nectar e em `CommercialProposal`, que só existe no servidor
 * de produção. Enquanto ninguém disser qual é, esta função **recusa em vez de emitir**:
 * recusar é reversível, emitir código repetido não é.
 *
 * A referência resolvia isso varrendo o Nectar a cada pedido (`/api/nectar/next-number`).
 * Aqui o Nectar é consultado **uma vez**, na semeadura, e depois a sequence do Postgres
 * responde sozinha — sem depender de sistema externo no caminho de uma ação do usuário.
 */

const SINGLETON = 'singleton';

export class NumeracaoNaoSemeadaError extends ComercialError {
  constructor() {
    super(
      'A numeração de propostas ainda não foi semeada neste ambiente. ' +
        'Um operador precisa registrar o maior número já usado antes da primeira emissão.',
      503
    );
    this.name = 'NumeracaoNaoSemeadaError';
  }
}

/** Estado da numeração, para diagnóstico e para a tela decidir o que mostrar. */
export async function numberingStatus(prismaClient) {
  const linha = await prismaClient.proposalNumberingState.findUnique({
    where: { id: SINGLETON }
  });

  return {
    seeded: Boolean(linha?.seededAt),
    seededAt: linha?.seededAt ?? null,
    seedValue: linha?.seedValue ?? null
  };
}

/**
 * Emite o próximo número.
 *
 * `nextval` é atômico no Postgres — dois pedidos simultâneos recebem números
 * diferentes sem transação explícita. É a razão de a numeração ser uma sequence e
 * não um `MAX() + 1`, que sob concorrência entrega o mesmo número duas vezes.
 *
 * **Um número consumido não volta.** Se o usuário desistir do levantamento, aquele
 * número fica sem proposta — buraco na sequência é normal e preferível a reaproveitar.
 */
export async function nextProposalNumber(prismaClient) {
  const estado = await numberingStatus(prismaClient);
  if (!estado.seeded) throw new NumeracaoNaoSemeadaError();

  const linhas = await prismaClient.$queryRawUnsafe(
    "SELECT nextval('comercial.proposal_number_seq') AS numero"
  );
  return Number(linhas[0].numero);
}

/**
 * Semeia a numeração. Chamada **uma vez por ambiente**, pelo operador.
 *
 * `setval(..., false)` faz o próximo `nextval` devolver exatamente `proximoNumero` —
 * com `true` ele devolveria o seguinte, e o primeiro número disponível se perderia.
 */
export async function seedNumbering(prismaClient, { proximoNumero, rotulo }) {
  const numero = Number(proximoNumero);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ComercialError('O número de partida precisa ser um inteiro positivo.', 400);
  }

  const estado = await numberingStatus(prismaClient);
  if (estado.seeded) {
    throw new ComercialError(
      `A numeração já foi semeada em ${estado.seededAt.toISOString()}. ` +
        'Semear de novo reemitiria números já usados.',
      409
    );
  }

  await prismaClient.$queryRawUnsafe(
    "SELECT setval('comercial.proposal_number_seq', $1, false)",
    numero
  );

  await prismaClient.proposalNumberingState.update({
    where: { id: SINGLETON },
    data: { seededAt: new Date(), seedValue: numero, seededByLabel: rotulo || null }
  });

  return { proximoNumero: numero };
}
