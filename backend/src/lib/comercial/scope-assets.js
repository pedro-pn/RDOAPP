import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { SCOPE_PHOTO_LIMITS, matchesImageSignature } from '../../../../shared/schemas/comercial.js';
import { ComercialError } from './cost-estimates.js';
import { caminhoAbsoluto, raizComercial } from './storage.js';

/**
 * Fotos dos blocos de conteúdo do escopo (tarefas T074a e T074b).
 *
 * **A cadeia de recusa é a razão de este arquivo existir**, e a ordem dela importa:
 * cada condição tem mensagem própria, porque "arquivo inválido" não diz a ninguém o
 * que fazer a seguir.
 *
 * A verificação de **assinatura de bytes não é opcional**. Sem ela qualquer arquivo
 * renomeado para `.jpg` entra — e ele chega com `Content-Type: image/jpeg`, porque
 * quem renomeia também controla o cabeçalho. Confiar no `Content-Type` é confiar em
 * quem envia.
 *
 * O cliente otimiza antes de enviar (redimensiona, achata sobre branco, recomprime).
 * **O servidor não confia nisso e revalida tudo**: a otimização existe para caber, a
 * validação existe porque pode ser contornada.
 */

const EXTENSAO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

/** `escopo/AAAA/MM/` — o padrão da referência. Particiona por data para a pasta não crescer sem fim. */
function pastaDoMes(agora = new Date()) {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return path.join('escopo', String(ano), mes);
}

/**
 * A raiz é a do módulo inteiro (`storage.js`), não uma própria.
 *
 * Duas definições da mesma pasta divergiriam no dia em que `COMERCIAL_DIR` for
 * apontada para outro lugar: os documentos iriam para o caminho novo e as fotos
 * continuariam no antigo, sem erro nenhum — até alguém abrir uma proposta velha.
 */
export function raizDasFotos() {
  return raizComercial();
}

/**
 * Sanea o nome original.
 *
 * O nome é guardado só para exibição — o arquivo em disco tem nome de UUID. Ainda
 * assim ele é limpo aqui: nome vindo do cliente que chega até um caminho é a forma
 * clássica de escapar da pasta (`../../etc/...`).
 */
export function sanearNome(nome) {
  const base = path.basename(String(nome || '')).replace(/[^\w.\- ]+/g, '_');
  return base.slice(0, 180) || 'foto';
}

/**
 * A cadeia de recusa, na ordem do contrato.
 *
 * Devolve `{ contentType, extensao }` ou lança `ComercialError` com o status certo.
 * É função pura sobre bytes — testável sem tocar em disco, que é onde os enganos
 * desta lista aparecem.
 */
export function validarFoto({ bytes, contentType }) {
  if (!bytes || bytes.length === 0) {
    throw new ComercialError('Selecione uma foto para o escopo.', 400);
  }

  const tipo = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!SCOPE_PHOTO_LIMITS.allowedTypes.includes(tipo)) {
    throw new ComercialError('Use uma imagem JPEG, PNG ou WebP.', 415);
  }

  if (bytes.length > SCOPE_PHOTO_LIMITS.maxBytes) {
    throw new ComercialError('A foto processada deve ter no máximo 1,5 MB.', 413);
  }

  // Última, e a que não se pode pular: o conteúdo tem de ser o que o tipo diz.
  if (!matchesImageSignature(bytes, tipo)) {
    throw new ComercialError(
      'O conteúdo do arquivo não corresponde a uma imagem válida.',
      415
    );
  }

  return { contentType: tipo, extensao: EXTENSAO[tipo] };
}

/**
 * Grava a foto e devolve o registro que a tela guarda no bloco.
 *
 * O `assetKey` é o caminho **relativo**. Guardar caminho absoluto amarraria o banco à
 * máquina, e mover a pasta de uploads quebraria toda foto já salva.
 */
export async function gravarFoto(prismaClient, { bytes, contentType, fileName, userId }) {
  const { contentType: tipo, extensao } = validarFoto({ bytes, contentType });

  const id = randomUUID();
  const relativo = path.join(pastaDoMes(), `${id}.${extensao}`);
  const absoluto = path.join(raizDasFotos(), relativo);

  await mkdir(path.dirname(absoluto), { recursive: true });
  await writeFile(absoluto, bytes);

  const registro = await prismaClient.scopePhotoAsset.create({
    data: {
      id,
      assetKey: relativo.split(path.sep).join('/'),
      contentType: tipo,
      byteSize: bytes.length,
      fileName: sanearNome(fileName),
      uploadedByUserId: userId
    }
  });

  return {
    id: registro.id,
    assetKey: registro.assetKey,
    fileName: registro.fileName,
    contentType: registro.contentType,
    byteSize: registro.byteSize
  };
}

/**
 * Lê a foto para servir.
 *
 * O caminho é montado a partir do `assetKey` **do banco**, nunca do que o cliente
 * mandou, e ainda assim é conferido contra a raiz: se o `assetKey` algum dia sair da
 * pasta, isto recusa em vez de servir um arquivo qualquer do disco.
 */
export async function lerFoto(prismaClient, id) {
  const registro = await prismaClient.scopePhotoAsset.findUnique({ where: { id } });
  if (!registro) throw new ComercialError('Foto não encontrada.', 404);

  const bytes = await readFile(caminhoAbsoluto(registro.assetKey));
  return { bytes, contentType: registro.contentType, fileName: registro.fileName };
}
