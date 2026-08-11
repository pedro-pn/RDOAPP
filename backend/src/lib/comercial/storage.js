import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import env from '../../config/env.js';
import { ComercialError } from './cost-estimates.js';

/**
 * Gravação e leitura em disco do módulo Comercial (tarefa T074).
 *
 * Porte de `db/proposals.ts`, que na referência gravava num bucket R2 do
 * Cloudflare. Aqui o destino é o disco, sob `COMERCIAL_DIR` — o mesmo caminho
 * que as fotos de escopo já usavam, agora com **um dono só**.
 *
 * **Todo caminho guardado é relativo.** Guardar caminho absoluto amarraria o
 * banco à máquina: mover a pasta, ou restaurar o backup noutro servidor,
 * quebraria todo documento já emitido. O absoluto é montado na hora da leitura,
 * a partir da raiz atual.
 *
 * **E toda leitura confere se o caminho ficou dentro da raiz.** O `storagePath`
 * vem do banco, não do cliente — mas o dia em que vier de outro lugar, isto
 * recusa em vez de servir um arquivo qualquer do disco.
 */

export function raizComercial() {
  return env.comercialDir;
}

/**
 * Resolve um caminho relativo dentro da raiz do módulo, recusando o que escapar.
 *
 * `path.resolve` normaliza `..`, então `escopo/../../etc/passwd` vira um caminho
 * de verdade fora da raiz — e é exatamente isso que a comparação abaixo pega.
 */
export function caminhoAbsoluto(relativo) {
  const raiz = path.resolve(raizComercial());
  const absoluto = path.resolve(raiz, String(relativo || ''));

  if (absoluto !== raiz && !absoluto.startsWith(raiz + path.sep)) {
    throw new ComercialError('Caminho de arquivo inválido.', 400);
  }

  return absoluto;
}

/**
 * Normaliza o código da proposta para virar nome de pasta.
 *
 * Portado de `proposalObjectPrefix`: sem acento, só letra, número, ponto, hífen
 * e sublinhado. O código chega de um campo de texto e vai virar caminho — a
 * normalização é o que impede que barra ou espaço dentro dele criem pasta onde
 * não devia.
 */
export function normalizarCodigo(codigo) {
  const limpo = String(codigo || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  // O ponto \u00e9 permitido \u2014 nomes de proposta o usam \u2014, mas um c\u00f3digo feito s\u00f3 de
  // pontos sobrevive \u00e0 limpeza como `..`, e `..` continua sendo "suba um n\u00edvel"
  // depois de virar segmento de caminho. `caminhoAbsoluto` ainda barraria a sa\u00edda
  // da raiz, mas o arquivo iria parar fora da pasta de propostas sem ningu\u00e9m
  // notar. Aqui ele vira o mesmo caso do c\u00f3digo vazio.
  if (!limpo || /^\.+$/.test(limpo)) return 'sem-numero';

  return limpo;
}

/**
 * A pasta de uma emissão: `propostas/<código>/<id>`.
 *
 * O `id` é novo a cada emissão, e é de propósito. Reemitir antes de finalizar
 * grava numa pasta nova em vez de sobrescrever a anterior — o arquivo que
 * alguém já baixou continua sendo o arquivo que ele baixou.
 */
export function pastaDaEmissao(proposalCode, id) {
  return path.posix.join('propostas', normalizarCodigo(proposalCode), id);
}

/** Grava e devolve o caminho **relativo**, que é o que vai para o banco. */
export async function gravarArquivo(relativo, bytes) {
  const absoluto = caminhoAbsoluto(relativo);
  await mkdir(path.dirname(absoluto), { recursive: true });
  await writeFile(absoluto, bytes);
  return { storagePath: paraPosix(relativo), byteSize: bytes.length };
}

/**
 * Lê um arquivo gravado.
 *
 * Arquivo ausente vira 404 com texto próprio: o registro existe no banco e o
 * arquivo sumiu do disco é um caso real — backup restaurado pela metade, pasta
 * movida — e "ENOENT" não diz isso a ninguém.
 */
export async function lerArquivo(relativo) {
  const absoluto = caminhoAbsoluto(relativo);
  try {
    return await readFile(absoluto);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ComercialError('O arquivo não está mais disponível no servidor.', 404);
    }
    throw error;
  }
}

/**
 * O caminho guardado usa barra normal sempre, inclusive no Windows.
 * Gravar `\` no banco tornaria o registro ilegível no servidor Linux.
 */
function paraPosix(relativo) {
  return String(relativo).split(path.sep).join('/');
}
