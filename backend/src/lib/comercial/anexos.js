import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { ATTACHMENT_LIMITS, formatFileSize } from '../../../../shared/schemas/comercial.js';
import { canWrite, denialReason } from './access.js';
import { ComercialError } from './cost-estimates.js';
import { documentosAtuais } from './documentos.js';
import { gravarArquivo, lerArquivo, normalizarCodigo } from './storage.js';

/**
 * Arquivos adicionais do cliente (tarefas T076d e T076e).
 *
 * São o `PROP-CTL-081` — ART, folha de dados, especificação — e vão para **a
 * mesma pasta** dos dois documentos no destino externo.
 *
 * **Um por requisição**, ao contrário da referência, que mandava tudo junto no
 * `finalize`. Separar evita estourar o limite de corpo em proposta com muitos
 * anexos, e dá ao usuário a recusa **no arquivo que a causou** em vez de um erro
 * no fim de um envio de 20 MB.
 *
 * **O limite é agregado** (FR-059), e é a regra que este arquivo existe para
 * fazer valer: cinco anexos de 5 MB passam um a um e estouram juntos.
 */

/** Extensões que não podem entrar: o anexo é lido por gente, não executado. */
const EXTENSOES_RECUSADAS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.ps1', '.sh',
  '.js', '.jse', '.vbs', '.vbe', '.jar', '.app', '.dll', '.lnk', '.hta'
]);

/**
 * Sanea o nome que o cliente mandou.
 *
 * Ele é guardado para exibição **e** vira nome no destino externo, então passa
 * pela mesma limpeza que o SharePoint exige. O arquivo em disco tem nome de
 * UUID: nome vindo do cliente que chega a um caminho é a forma clássica de
 * escapar da pasta.
 */
export function sanearNome(nome, reserva = 'anexo') {
  const limpo = String(nome || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180);

  return limpo || reserva;
}

export function extensaoDe(nome) {
  const extensao = path.extname(String(nome || '')).toLowerCase();
  return extensao.length > 12 ? '' : extensao;
}

/**
 * A cadeia de recusa, na ordem em que as perguntas fazem sentido.
 *
 * Cada caso tem a sua mensagem: "arquivo vazio", "tipo não aceito" e "o
 * conjunto estourou" mandam o usuário para lugares diferentes.
 */
export function validarAnexo({ bytes, fileName }, bytesJaUsados = 0) {
  if (!bytes || bytes.length === 0) {
    throw new ComercialError('Selecione um arquivo para anexar.', 400);
  }

  const nome = sanearNome(fileName);
  const extensao = extensaoDe(nome);

  if (EXTENSOES_RECUSADAS.has(extensao)) {
    throw new ComercialError(
      `Arquivo ${extensao} não é aceito como anexo. Envie documento, planilha ou imagem.`,
      415
    );
  }

  const total = bytesJaUsados + bytes.length;
  if (total > ATTACHMENT_LIMITS.maxAggregateBytes) {
    throw new ComercialError(mensagemDoLimite(total), 413);
  }

  return { nome, extensao };
}

/**
 * A mensagem do limite diz **quanto** e **quanto cabe**, e o que fazer.
 *
 * Porte de `validateFinalizationUploadSize`. "Arquivo muito grande" sozinho não
 * ajuda quem tem seis anexos e não sabe qual sacrificar.
 */
export function mensagemDoLimite(total) {
  return (
    `Os documentos e os anexos somam ${formatFileSize(total)}. ` +
    `O limite por finalização é ${formatFileSize(ATTACHMENT_LIMITS.maxAggregateBytes)}. ` +
    'Remova ou compacte anexos grandes e tente novamente.'
  );
}

/**
 * Quanto já está comprometido no envio desta proposta.
 *
 * Conta os documentos vigentes **mais** os anexos existentes. A planilha de
 * custos fica de fora porque ainda não existe no momento do upload — ela é
 * gerada na finalização, e é lá que a conta final acontece.
 */
export async function bytesComprometidos(prisma, proposalId) {
  const [documentos, anexos] = await Promise.all([
    documentosAtuais(prisma, proposalId),
    prisma.proposalAttachment.findMany({ where: { proposalId } })
  ]);

  const somar = (total, item) => total + (Number(item.byteSize) || 0);
  return documentos.reduce(somar, 0) + anexos.reduce(somar, 0);
}

export async function anexarArquivo(prisma, user, proposalId, { bytes, fileName }) {
  const proposta = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposta) throw new ComercialError('Proposta não encontrada.', 404);
  if (!canWrite(user, proposta)) {
    throw new ComercialError(denialReason(user, proposta), 403);
  }
  if (proposta.archivedAt) {
    throw new ComercialError('Proposta arquivada. Desarquive antes de anexar.', 409);
  }
  // Proposta finalizada não recebe anexo: os arquivos já foram ao CRM e ao
  // SharePoint, e um anexo novo aqui ficaria só no nosso disco — visível na tela
  // e ausente do destino, que é pior que não aceitar.
  if (proposta.status === 'FINALIZADA') {
    throw new ComercialError(
      'Proposta já finalizada. Crie uma revisão para anexar novos arquivos.',
      409
    );
  }

  const { nome, extensao } = validarAnexo(
    { bytes, fileName },
    await bytesComprometidos(prisma, proposalId)
  );

  const relativo = path.posix.join(
    'propostas',
    normalizarCodigo(proposta.proposalCode),
    'anexos',
    `${randomUUID()}${extensao}`
  );

  // Disco primeiro, banco depois — a mesma ordem dos documentos. Registro
  // apontando para arquivo que não existe é um link que só falha ao clicar.
  const { storagePath, byteSize } = await gravarArquivo(relativo, bytes);

  return prisma.proposalAttachment.create({
    data: {
      proposalId,
      storagePath,
      originalName: nome,
      byteSize,
      createdByUserId: user.id
    }
  });
}

export async function listarAnexos(prisma, user, proposalId) {
  const proposta = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposta) throw new ComercialError('Proposta não encontrada.', 404);
  if (!canWrite(user, proposta)) {
    throw new ComercialError(denialReason(user, proposta), 403);
  }

  const items = await prisma.proposalAttachment.findMany({
    where: { proposalId },
    orderBy: { createdAt: 'asc' }
  });

  return {
    items: items.map(item => ({
      id: item.id,
      originalName: item.originalName,
      byteSize: item.byteSize,
      createdAt: item.createdAt
    })),
    total: items.length,
    bytesUsados: await bytesComprometidos(prisma, proposalId),
    bytesDisponiveis: ATTACHMENT_LIMITS.maxAggregateBytes
  };
}

/** Os anexos prontos para irem ao destino externo, junto com os documentos. */
export async function arquivosAnexados(prisma, proposalId) {
  const anexos = await prisma.proposalAttachment.findMany({
    where: { proposalId },
    orderBy: { createdAt: 'asc' }
  });

  const arquivos = [];
  for (const anexo of anexos) {
    arquivos.push({ fileName: anexo.originalName, bytes: await lerArquivo(anexo.storagePath) });
  }
  return arquivos;
}

/**
 * A conferência final do limite agregado (FR-059).
 *
 * Roda na finalização, com **os arquivos de verdade** — inclusive a planilha de
 * custos, que não existia no momento do upload. É a única conta que vê tudo.
 */
export function exigirLimiteAgregado(arquivos) {
  const total = arquivos.reduce((soma, item) => soma + (item.bytes?.length || 0), 0);
  if (total > ATTACHMENT_LIMITS.maxAggregateBytes) {
    throw new ComercialError(mensagemDoLimite(total), 413);
  }
  return total;
}
