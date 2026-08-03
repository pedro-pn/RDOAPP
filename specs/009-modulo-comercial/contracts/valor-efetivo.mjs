#!/usr/bin/env node
/**
 * Qual valor VENCE na referência congelada?
 *
 * O `globals.css` do comercialAPP tem 778 linhas numa folha só, com dois blocos
 * `:root` conflitantes e dezenas de regras que se sobrescrevem. Ler a primeira
 * ocorrência de um seletor produz o valor errado, e o erro é invisível: o CSS
 * portado fica plausível e não bate com a tela.
 *
 * Já aconteceu duas vezes neste porte:
 *
 *   1. A paleta. O `:root` da linha 26 é azul e é código morto; o da linha 56
 *      é verde e vence.
 *   2. O logotipo. `.cost-brand img{width:48px}` parece a regra, mas o elemento
 *      também tem a classe `brand`, e `.brand>img{width:184px}` vem depois com a
 *      mesma especificidade — então vence. Portei 48px e o logo virou uma tira.
 *
 * Esta ferramenta responde "qual valor vence" considerando ORDEM e
 * ESPECIFICIDADE, para um elemento com um conjunto de classes.
 *
 * Uso:
 *   node valor-efetivo.mjs <classes-do-elemento> [propriedade]
 *
 * Exemplos:
 *   node valor-efetivo.mjs "brand cost-brand" width
 *   node valor-efetivo.mjs "cost-hero"
 *   node valor-efetivo.mjs "brand cost-brand>img" width
 *
 * Por padrão ela reporta o estado BASE: regras com pseudo-classe (`:disabled`,
 * `:hover`) e pseudo-elemento (`::after`) ficam de fora, senão a cor de botão
 * desabilitado aparece como se fosse a normal. Use `COMERCIAL_INCLUI_ESTADOS=1`
 * para vê-las — foi assim que apareceram os dois decorativos do `.cost-hero`,
 * que eu tinha deixado de portar.
 *
 * `COMERCIAL_LARGURA=390` responde para celular em vez de desktop.
 *
 * Limitação honesta: é um casador de classe, não um motor de CSS. Use para
 * achar candidatos e confirme na captura da baseline.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CSS_PATH =
  process.env.COMERCIAL_REF_CSS || join(homedir(), 'comercialAPP/app/globals.css');

/** Especificidade (a,b,c) de um seletor simples, ignorando `!important`. */
function especificidade(seletor) {
  const ids = (seletor.match(/#[\w-]+/g) || []).length;
  const classes = (seletor.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?![\w-]*\()/g) || []).length;
  const tags = (seletor.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, tags];
}

function comparaEspecificidade(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * O seletor casa com este elemento?
 *
 * O elemento é descrito por um conjunto de classes (os ancestrais conhecidos
 * mais o próprio) e, opcionalmente, uma tag alvo. Um seletor casa quando:
 *
 *   - a ÚLTIMA parte (o alvo) tem só classes que o elemento tem, e a tag bate;
 *   - cada parte ANTERIOR (ancestral) tem só classes conhecidas.
 *
 * A segunda condição é o que impede `.login-card > img` de casar com o
 * logotipo da barra: `login-card` não está na lista, então o seletor descreve
 * outro elemento. Sem ela a ferramenta mente, e mentira aqui é pior que
 * silêncio — foi assim que o logo de 48px entrou no porte.
 */
function casa(seletor, classes, tag) {
  const partes = seletor.trim().split(/[\s>+~]+/).filter(Boolean);
  if (!partes.length) return false;

  const alvo = partes[partes.length - 1];
  const ancestrais = partes.slice(0, -1);

  if (/[#[]/.test(alvo)) return false;

  // Pseudo-classe e pseudo-elemento descrevem OUTRO estado, não o base. Sem
  // este corte a ferramenta reporta o `:disabled` do botão como se fosse a
  // cor normal — foi o que ela fez na primeira execução com `.primary`.
  if (/:/.test(alvo) && !process.env.COMERCIAL_INCLUI_ESTADOS) return false;

  const classesDoAlvo = (alvo.match(/\.[\w-]+/g) || []).map(c => c.slice(1));
  const tagDoAlvo = (alvo.match(/^[a-z][\w-]*/i) || [])[0];

  if (tagDoAlvo && tag && tagDoAlvo.toLowerCase() !== tag.toLowerCase()) return false;
  if (tagDoAlvo && !tag) return false;
  if (!tagDoAlvo && tag && !classesDoAlvo.length) return false;
  if (!classesDoAlvo.every(c => classes.includes(c))) return false;

  // Todo ancestral citado tem de ser um ancestral conhecido.
  for (const parte of ancestrais) {
    if (/[#[]/.test(parte)) return false;
    const classesDaParte = (parte.match(/\.[\w-]+/g) || []).map(c => c.slice(1));
    if (!classesDaParte.length) return false;
    if (!classesDaParte.every(c => classes.includes(c))) return false;
  }

  return true;
}

/**
 * Varre a folha registrando em qual `@media` cada regra vive.
 *
 * Sem isto a ferramenta reporta valor de celular como se fosse de desktop —
 * outro jeito de mentir. O logo, por exemplo, é 184px no desktop e 145px
 * dentro de `@media(max-width:760px)`.
 */
function regras(css) {
  const encontradas = [];
  let ordem = 0;
  let i = 0;

  while (i < css.length) {
    const abre = css.indexOf('{', i);
    if (abre < 0) break;

    const cabecalho = css.slice(i, abre).trim();
    const linha = css.slice(0, abre).split('\n').length;

    if (cabecalho.startsWith('@')) {
      // Bloco aninhado: percorre até o fecha correspondente e desce um nível.
      let profundidade = 1;
      let j = abre + 1;
      while (j < css.length && profundidade > 0) {
        if (css[j] === '{') profundidade += 1;
        else if (css[j] === '}') profundidade -= 1;
        j += 1;
      }
      const interno = css.slice(abre + 1, j - 1);
      for (const regra of regras(interno)) {
        encontradas.push({ ...regra, media: cabecalho, ordem: ordem++, linha: linha + regra.linha - 1 });
      }
      i = j;
      continue;
    }

    const fecha = css.indexOf('}', abre);
    if (fecha < 0) break;
    const corpo = css.slice(abre + 1, fecha);
    for (const seletor of cabecalho.split(',').map(s => s.trim()).filter(Boolean)) {
      encontradas.push({ seletor, corpo, ordem: ordem++, linha, media: null });
    }
    i = fecha + 1;
  }

  return encontradas;
}

/**
 * A media query vale na largura alvo?
 * Cobre `max-width`/`min-width`, que é o que esta folha usa. `print` nunca vale.
 */
function mediaVale(media, largura) {
  if (!media) return true;
  if (/\bprint\b/.test(media)) return false;

  const max = /max-width\s*:\s*(\d+)/.exec(media);
  const min = /min-width\s*:\s*(\d+)/.exec(media);
  if (max && largura > Number(max[1])) return false;
  if (min && largura < Number(min[1])) return false;
  return true;
}

function propriedades(corpo) {
  const mapa = new Map();
  for (const par of corpo.split(';')) {
    const i = par.indexOf(':');
    if (i < 0) continue;
    mapa.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
  return mapa;
}

function main() {
  const entrada = process.argv[2];
  const propriedadeAlvo = process.argv[3];

  if (!entrada) {
    console.error('Uso: node valor-efetivo.mjs "<classes>" [propriedade]');
    console.error('Ex.:  node valor-efetivo.mjs "brand cost-brand>img" width');
    process.exit(1);
  }

  // "brand cost-brand>img" → classes [brand, cost-brand], tag img
  const [parteClasses, tag] = entrada.split('>');
  const classes = parteClasses.trim().split(/\s+/).filter(Boolean);

  const css = readFileSync(CSS_PATH, 'utf8');
  const larguraAlvo = Number(process.env.COMERCIAL_LARGURA || 1440);
  const candidatas = regras(css)
    .filter(r => casa(r.seletor, classes, tag?.trim()))
    .filter(r => mediaVale(r.media, larguraAlvo));

  if (!candidatas.length) {
    console.log('Nenhuma regra casou.');
    return;
  }

  const vencedor = new Map();
  for (const regra of candidatas) {
    const espec = especificidade(regra.seletor);
    for (const [prop, valor] of propriedades(regra.corpo)) {
      if (propriedadeAlvo && prop !== propriedadeAlvo) continue;
      const atual = vencedor.get(prop);
      if (
        !atual ||
        comparaEspecificidade(espec, atual.espec) > 0 ||
        (comparaEspecificidade(espec, atual.espec) === 0 && regra.ordem > atual.ordem)
      ) {
        vencedor.set(prop, {
          valor,
          espec,
          ordem: regra.ordem,
          seletor: regra.seletor,
          linha: regra.linha,
          media: regra.media
        });
      }
    }
  }

  console.log(`Elemento: .${classes.join('.')}${tag ? ` (${tag})` : ''}`);
  console.log(`Largura alvo: ${larguraAlvo}px (COMERCIAL_LARGURA para mudar)`);
  console.log(`Regras que casam: ${candidatas.length}\n`);

  const nomes = [...vencedor.keys()].sort();
  for (const prop of nomes) {
    const v = vencedor.get(prop);
    console.log(`  ${prop}: ${v.valor}`);
    console.log(
      `      vence via "${v.seletor}"${v.media ? ` dentro de ${v.media}` : ''}` +
        ` (linha ${v.linha}, espec ${v.espec.join(',')})`
    );
  }

  if (propriedadeAlvo && !vencedor.size) {
    console.log(`  (nenhuma regra define "${propriedadeAlvo}")`);
  }
}

main();
