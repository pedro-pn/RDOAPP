import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PROPOSAL_VISUAL_DEFINITIONS } from '../../../../shared/comercial/dist/proposal-visuals.js';
import env from '../../config/env.js';

/**
 * As imagens fixas do documento — tarefa T072.
 *
 * São a capa, o papel timbrado e as institucionais (métricas, clientes e as duas
 * galerias). Todas JPEG, todas em `ASSETS_DIR/Comercial`.
 *
 * **Incorporadas uma vez por documento.** `embedJpg` a cada uso repetiria os
 * bytes do timbrado em toda folha — e o timbrado sozinho tem quase um megabyte.
 * Numa proposta de quinze páginas isso é a diferença entre um anexo de e-mail
 * que passa e um que volta.
 *
 * O preparo de imagem que precisa de `sharp` — converter foto de escopo enviada
 * pelo usuário, que pode ser PNG ou WebP — é a T073, não entra aqui.
 */

const PASTA = () => path.join(env.assetsDir, 'Comercial');

const CAPAS = {
  commercial: 'proposta-capa-comercial.jpg',
  technical: 'proposta-capa-tecnica.jpg'
};

const TIMBRADO = 'proposta-pagina.jpg';

/** Só o nome do arquivo: as definições vêm com o caminho web da referência. */
const arquivoDe = definicao => definicao.src.split('/').pop();

async function incorporar(pdf, cache, arquivo) {
  if (cache.has(arquivo)) return cache.get(arquivo);
  const bytes = await readFile(path.join(PASTA(), arquivo));
  const imagem = await pdf.embedJpg(bytes);
  cache.set(arquivo, imagem);
  return imagem;
}

/**
 * Carrega tudo o que o documento desenha, na forma que o gerador consome.
 *
 * Cada visual leva junto a `proporcao` de `proposal-visuals.ts` — cópia byte a
 * byte da referência. É ela que decide a altura a partir da largura; usar a
 * proporção real do arquivo em vez desta faria a imagem sair de tamanho
 * diferente do que a referência desenha.
 */
export async function carregarImagens(pdf, tipo) {
  const cache = new Map();
  const visual = async definicao => ({
    imagem: await incorporar(pdf, cache, arquivoDe(definicao)),
    proporcao: definicao.aspectRatio
  });

  const galeria = definicoes => Promise.all(definicoes.map(visual));

  return {
    capa: await incorporar(pdf, cache, CAPAS[tipo] || CAPAS.commercial),
    timbrado: await incorporar(pdf, cache, TIMBRADO),
    metricas: await visual(PROPOSAL_VISUAL_DEFINITIONS.metrics),
    clientes: await visual(PROPOSAL_VISUAL_DEFINITIONS.clients),
    galeriaDeServicos: await galeria(PROPOSAL_VISUAL_DEFINITIONS.serviceGallery),
    galeriaDeEquipamentos: await galeria(PROPOSAL_VISUAL_DEFINITIONS.equipmentGallery)
  };
}
