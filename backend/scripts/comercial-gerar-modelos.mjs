#!/usr/bin/env node
/**
 * Transforma as propostas PREENCHIDAS em MODELOS com marcadores.
 *
 * Entrada: os `.docx` de `Modelos/definitivos/Comercial/` como o comercial os
 * entregou — com dados de uma negociação real dentro.
 * Saída: os mesmos arquivos com `{{marcador}}` no lugar dos valores.
 *
 * **Por que um script e não edição à mão.** Abrir no Word e apagar valor por
 * valor destruiria a formatação em algum lugar sem ninguém notar — e são 23
 * campos em quatro arquivos. Aqui a troca é cirúrgica: o campo de mala direta é
 * substituído por um run que **herda o `rPr` do valor que estava ali**, então
 * fonte, tamanho, negrito e cor sobrevivem.
 *
 * Rode de novo sempre que o comercial entregar um documento novo:
 *
 *   node scripts/comercial-gerar-modelos.mjs
 *
 * É idempotente: um documento que já virou modelo não tem mais campo de mala
 * direta, então nada acontece.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEM = path.resolve(AQUI, '../../Modelos/definitivos/Comercial');
const DESTINO = path.resolve(AQUI, '../../Modelos/definitivos/Comercial/modelos');

/** As partes do pacote que podem conter campo de mala direta. */
const PARTES = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];

function filhosDiretos(no, nome) {
  const saida = [];
  for (let filho = no.firstChild; filho; filho = filho.nextSibling) {
    if (filho.nodeName === nome) saida.push(filho);
  }
  return saida;
}

/** O `w:fldChar` de um run, se houver. */
function tipoDeCampo(run) {
  const marcas = filhosDiretos(run, 'w:fldChar');
  return marcas.length ? marcas[0].getAttribute('w:fldCharType') : null;
}

function textoDeInstrucao(run) {
  return filhosDiretos(run, 'w:instrText')
    .map(no => no.textContent || '')
    .join('');
}

/**
 * Troca um campo de mala direta pelo marcador.
 *
 * O run que sobra é o **primeiro do resultado** — aquele que carregava o valor
 * preenchido —, porque é ele que tem a formatação com que o valor era exibido.
 * Ficar com o `rPr` do `instrText` daria a formatação do código do campo, que
 * no Word é invisível e pode divergir.
 */
function trocarCampo(paragrafo, campo, doc) {
  const { inicio, fim, nome, resultado } = campo;
  const modelo = resultado[0] || inicio;

  const novo = modelo.cloneNode(true);
  // Fora o `rPr`, tudo o que sobrou do run modelo é lixo do campo antigo.
  for (let filho = novo.firstChild; filho; ) {
    const proximo = filho.nextSibling;
    if (filho.nodeName !== 'w:rPr') novo.removeChild(filho);
    filho = proximo;
  }

  const texto = doc.createElement('w:t');
  texto.setAttribute('xml:space', 'preserve');
  texto.appendChild(doc.createTextNode(`{{${nome}}}`));
  novo.appendChild(texto);

  paragrafo.insertBefore(novo, inicio);

  // Remove o campo inteiro: begin, instrução, separate, resultado e end.
  let atual = inicio;
  while (atual) {
    const proximo = atual.nextSibling;
    paragrafo.removeChild(atual);
    if (atual === fim) break;
    atual = proximo;
  }
}

/** Localiza os campos de um parágrafo, de trás para frente na remoção. */
function camposDoParagrafo(paragrafo) {
  const runs = filhosDiretos(paragrafo, 'w:r');
  const campos = [];
  let atual = null;

  for (const run of runs) {
    const tipo = tipoDeCampo(run);

    if (tipo === 'begin') {
      atual = { inicio: run, fim: null, instrucao: '', resultado: [], separado: false };
      continue;
    }
    if (!atual) continue;

    if (tipo === 'separate') {
      atual.separado = true;
      continue;
    }
    if (tipo === 'end') {
      atual.fim = run;
      const nome = /MERGEFIELD\s+"?([A-Za-z0-9_]+)/.exec(atual.instrucao);
      if (nome) campos.push({ ...atual, nome: nome[1] });
      atual = null;
      continue;
    }

    if (atual.separado) atual.resultado.push(run);
    else atual.instrucao += textoDeInstrucao(run);
  }

  return campos;
}

function converterParte(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paragrafos = Array.from(doc.getElementsByTagName('w:p'));
  let trocados = 0;

  for (const paragrafo of paragrafos) {
    // De trás para frente: remover um campo mexe na lista de irmãos, e ir de
    // frente invalidaria as referências dos campos seguintes.
    const campos = camposDoParagrafo(paragrafo).reverse();
    for (const campo of campos) {
      trocarCampo(paragrafo, campo, doc);
      trocados += 1;
    }
  }

  return { xml: new XMLSerializer().serializeToString(doc), trocados };
}

async function converterArquivo(entrada, saida) {
  const zip = new AdmZip(await readFile(entrada));
  let total = 0;

  for (const parte of PARTES) {
    const item = zip.getEntry(parte);
    if (!item) continue;
    const { xml, trocados } = converterParte(item.getData().toString('utf8'));
    if (!trocados) continue;
    zip.updateFile(parte, Buffer.from(xml, 'utf8'));
    total += trocados;
  }

  await writeFile(saida, zip.toBuffer());
  return total;
}

async function principal() {
  const arquivos = (await readdir(ORIGEM)).filter(
    nome => nome.endsWith('.docx') && !nome.includes(':Zone')
  );

  if (!arquivos.length) {
    console.error(`Nenhum .docx em ${ORIGEM}`);
    process.exitCode = 1;
    return;
  }

  const { mkdir } = await import('node:fs/promises');
  await mkdir(DESTINO, { recursive: true });

  for (const nome of arquivos) {
    const destino = path.join(DESTINO, nome.replace(/\s*-\s*(Preenchid[ao]|preenchido|Modelo)\.docx$/i, '.docx'));
    const trocados = await converterArquivo(path.join(ORIGEM, nome), destino);
    console.log(`${nome} -> ${path.basename(destino)}  (${trocados} campos)`);
  }
}

principal().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
