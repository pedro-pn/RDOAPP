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


// ---------------------------------------------------------------------------
// Fase 2 — as tabelas de tamanho variável
// ---------------------------------------------------------------------------

/**
 * A matriz e a tabela de preços crescem conforme a proposta, então elas não
 * podem ficar com o conteúdo de exemplo do documento. Cada uma vira UMA
 * linha-modelo, que o preenchimento clona.
 *
 * A matriz tem **duas formas de linha**, e é isso que exige duas modelos: o
 * subtítulo da categoria é uma célula só, mesclada nas três colunas, e o item
 * são três células. Uma modelo só não conseguiria desenhar as duas.
 *
 * A coluna "Item" fica vazia de propósito: no documento ela é lista numerada do
 * Word, e a numeração se refaz sozinha quando as linhas são clonadas. Pôr um
 * `{{n}}` ali trocaria numeração automática por numeração nossa, e as duas
 * divergiriam na primeira linha que quebrasse de página.
 */

const textoDoNo = no => {
  let saida = '';
  const visitar = atual => {
    if (atual.nodeName === 'w:t') saida += atual.textContent || '';
    for (let filho = atual.firstChild; filho; filho = filho.nextSibling) visitar(filho);
  };
  visitar(no);
  return saida;
};

/**
 * Substitui o texto de uma célula, preservando a formatação do primeiro run.
 *
 * **Célula vazia não tem `w:t` nenhum**, e é o caso que passa despercebido: a
 * coluna NOTA da matriz e as colunas da tabela de preços do modelo padrão estão
 * em branco no documento. Sem criar o run, o marcador simplesmente não é
 * escrito, e o campo some do documento sem erro nenhum.
 */
function definirTextoDaCelula(celula, valor) {
  let textos = Array.from(celula.getElementsByTagName('w:t'));

  if (!textos.length) {
    if (!valor) return;
    const doc = celula.ownerDocument;
    const paragrafos = filhosDiretos(celula, 'w:p');
    const paragrafo = paragrafos[0] || celula.appendChild(doc.createElement('w:p'));
    const run = doc.createElement('w:r');

    // **O `rPr` do parágrafo é a formatação pretendida para o texto que ali se
    // digitaria** — é para isso que o Word o guarda na marca de parágrafo. Sem
    // copiá-lo, o run nasce com a fonte padrão do documento em vez da Arial 10
    // da tabela, e a linha muda de altura: a tabela sai torta no papel e
    // certinha no XML.
    const pPr = filhosDiretos(paragrafo, 'w:pPr')[0];
    const rPrDoParagrafo = pPr ? filhosDiretos(pPr, 'w:rPr')[0] : null;
    if (rPrDoParagrafo) run.appendChild(rPrDoParagrafo.cloneNode(true));

    const texto = doc.createElement('w:t');
    texto.setAttribute('xml:space', 'preserve');
    texto.appendChild(doc.createTextNode(valor));
    run.appendChild(texto);
    paragrafo.appendChild(run);
    return;
  }
  textos[0].setAttribute('xml:space', 'preserve');
  while (textos[0].firstChild) textos[0].removeChild(textos[0].firstChild);
  textos[0].appendChild(celula.ownerDocument.createTextNode(valor));
  for (let i = 1; i < textos.length; i += 1) {
    while (textos[i].firstChild) textos[i].removeChild(textos[i].firstChild);
  }
}

const celulas = linha => filhosDiretos(linha, 'w:tc');

/**
 * Remove fórmulas do Word de dentro de um nó.
 *
 * As tabelas de preço trazem `=PRODUCT(LEFT)` em cada linha e `=SUM(ABOVE)` no
 * total. Limpar só o `w:t` não basta: a fórmula mora em `w:instrText`, e
 * sobreviveria invisível. O problema é que **o LibreOffice não recalcula campo
 * na conversão** — o PDF sairia com o valor em cache, que é o da proposta de
 * exemplo. Um total errado, com cara de certo.
 */
function removerFormulas(no) {
  const doc = no.ownerDocument;

  // `w:fldSimple` embrulha o campo inteiro: o conteúdo sobe um nível e o
  // invólucro sai.
  for (const simples of Array.from(no.getElementsByTagName('w:fldSimple'))) {
    const pai = simples.parentNode;
    while (simples.firstChild) pai.insertBefore(simples.firstChild, simples);
    pai.removeChild(simples);
  }

  // Campo em três partes: o run que carrega `w:instrText` ou `w:fldChar` some.
  for (const marca of ['w:instrText', 'w:fldChar']) {
    for (const alvo of Array.from(no.getElementsByTagName(marca))) {
      const run = alvo.parentNode;
      if (run && run.nodeName === 'w:r' && run.parentNode) run.parentNode.removeChild(run);
      else if (alvo.parentNode) alvo.parentNode.removeChild(alvo);
    }
  }

  return doc;
}

function ehLinhaDeCategoria(linha) {
  return celulas(linha).length === 1;
}

/**
 * Transforma uma matriz em duas linhas-modelo.
 *
 * Guarda a primeira linha de cada forma que encontrar — assim os modelos herdam
 * a formatação real do documento, e não uma inventada aqui.
 */
function prepararMatriz(tabela, sufixo) {
  const linhas = filhosDiretos(tabela, 'w:tr');
  if (linhas.length < 3) return false;

  const cabecalho = linhas[0];
  const modeloCategoria = linhas.find(ehLinhaDeCategoria);
  const modeloItem = linhas.slice(1).find(linha => celulas(linha).length === 3);
  if (!modeloCategoria || !modeloItem) return false;

  definirTextoDaCelula(celulas(modeloCategoria)[0], `{{categoria_${sufixo}}}`);
  const doItem = celulas(modeloItem);
  definirTextoDaCelula(doItem[0], '');
  definirTextoDaCelula(doItem[1], `{{escopo_${sufixo}}}`);
  definirTextoDaCelula(doItem[2], `{{nota_${sufixo}}}`);

  for (const linha of linhas) {
    if (linha === cabecalho || linha === modeloCategoria || linha === modeloItem) continue;
    tabela.removeChild(linha);
  }
  // A ordem importa: a categoria abre o grupo, o item vem depois.
  tabela.insertBefore(modeloCategoria, modeloItem);
  return true;
}

/**
 * Transforma a tabela de preços numa linha-modelo mais o total.
 *
 * O total do documento é um campo `=SUM(ABOVE)` do Word. Ele vira `{{total}}`
 * porque o LibreOffice **não recalcula campo na conversão** — o PDF sairia com
 * o valor que estava em cache, que é o da proposta de exemplo.
 */
function prepararPrecos(tabela, sufixo) {
  const linhas = filhosDiretos(tabela, 'w:tr');
  if (linhas.length < 3) return false;

  const cabecalho = linhas[0];
  const total = linhas[linhas.length - 1];
  const modelo = linhas[1];
  const cols = celulas(modelo);
  if (cols.length < 5) return false;

  removerFormulas(modelo);
  removerFormulas(total);

  definirTextoDaCelula(cols[0], '');
  definirTextoDaCelula(cols[1], `{{descricao_${sufixo}}}`);
  definirTextoDaCelula(cols[2], `{{unitario_${sufixo}}}`);
  definirTextoDaCelula(cols[3], `{{quantidade_${sufixo}}}`);
  definirTextoDaCelula(cols[4], `{{valor_${sufixo}}}`);

  const colsTotal = celulas(total);
  definirTextoDaCelula(colsTotal[colsTotal.length - 1], `{{total_${sufixo}}}`);

  for (const linha of linhas) {
    if (linha === cabecalho || linha === modelo || linha === total) continue;
    tabela.removeChild(linha);
  }
  return true;
}


/**
 * A seção 2 vira um parágrafo-modelo por serviço.
 *
 * No documento entregue ela traz **um cardápio** dos serviços que a Filtrovali
 * presta — dez frases prontas, das quais a proposta usaria duas ou três. Quem
 * escolhe é a etapa Escopo do app, então o cardápio sai e sobra uma linha
 * clonável.
 *
 * O que NÃO sai: a NOTA sobre tubulações embarcadas. Ela não é item de lista, é
 * ressalva fixa do escopo, e some junto se a regra for "apaga tudo entre os dois
 * títulos".
 */
function prepararEscopo(doc) {
  const paragrafos = Array.from(doc.getElementsByTagName('w:p'));

  const nivelDe = paragrafo => {
    const pPr = filhosDiretos(paragrafo, 'w:pPr')[0];
    if (!pPr) return null;
    const numPr = filhosDiretos(pPr, 'w:numPr')[0];
    if (!numPr) return null;
    const ilvl = filhosDiretos(numPr, 'w:ilvl')[0];
    return ilvl ? Number(ilvl.getAttribute('w:val')) : 0;
  };

  // O título aparece duas vezes: no ÍNDICE e na seção. A seção é a última.
  const titulos = paragrafos.filter(
    p => nivelDe(p) === 0 && /Descrição dos serviços que serão executados/.test(textoDoNo(p))
  );
  const titulo = titulos[titulos.length - 1];
  if (!titulo) return 0;

  const inicio = paragrafos.indexOf(titulo);
  let fim = paragrafos.length;
  for (let i = inicio + 1; i < paragrafos.length; i += 1) {
    if (nivelDe(paragrafos[i]) === 0) {
      fim = i;
      break;
    }
  }

  const itens = paragrafos
    .slice(inicio + 1, fim)
    .filter(p => (nivelDe(p) ?? 0) >= 1);
  if (!itens.length) return 0;

  const modelo = itens[0];
  const textos = Array.from(modelo.getElementsByTagName('w:t'));
  textos[0].setAttribute('xml:space', 'preserve');
  while (textos[0].firstChild) textos[0].removeChild(textos[0].firstChild);
  textos[0].appendChild(doc.createTextNode('{{servico}}'));
  for (let i = 1; i < textos.length; i += 1) {
    while (textos[i].firstChild) textos[i].removeChild(textos[i].firstChild);
  }

  for (const item of itens.slice(1)) {
    if (item.parentNode) item.parentNode.removeChild(item);
  }
  return itens.length - 1;
}


/**
 * A data do cabeçalho passa a ser alinhada à direita de verdade.
 *
 * No documento entregue ela é empurrada por **109 espaços literais**. Isso
 * parece certo no Word, que foi onde alguém ajustou, mas a largura do espaço
 * difere entre renderizadores: no LibreOffice a linha estoura a margem e quebra,
 * e a data reaparece no começo da linha seguinte — ou seja, à esquerda.
 *
 * Trocar por `w:jc="right"` faz o alinhamento ser uma regra, e não uma
 * coincidência de métrica de fonte. E resolve o outro lado do mesmo problema:
 * a data preenchida é mais longa que o marcador, então mesmo no Word ela
 * empurraria a linha.
 */
function alinharDataDoCabecalho(doc) {
  const paragrafos = Array.from(doc.getElementsByTagName('w:p'));
  const alvo = paragrafos.find(p => textoDoNo(p).includes('{{data_texto}}'));
  if (!alvo) return false;

  for (const run of filhosDiretos(alvo, 'w:r')) {
    const texto = textoDoNo(run);
    if (texto.trim() === '') alvo.removeChild(run);
  }

  let pPr = filhosDiretos(alvo, 'w:pPr')[0];
  if (!pPr) {
    pPr = doc.createElement('w:pPr');
    alvo.insertBefore(pPr, alvo.firstChild);
  }
  for (const jc of filhosDiretos(pPr, 'w:jc')) pPr.removeChild(jc);
  const jc = doc.createElement('w:jc');
  jc.setAttribute('w:val', 'right');
  pPr.appendChild(jc);
  return true;
}

function prepararTabelas(doc) {
  const tabelas = Array.from(doc.getElementsByTagName('w:tbl'));
  let matrizes = 0;
  let precos = 0;

  for (const tabela of tabelas) {
    const primeira = filhosDiretos(tabela, 'w:tr')[0];
    if (!primeira) continue;
    const cabecalho = textoDoNo(primeira);

    if (/ESCOPO/.test(cabecalho) && /NOTA/.test(cabecalho)) {
      // A primeira matriz do documento é a da Filtrovali; a segunda, a do
      // contratante. É a ordem em que o documento as apresenta.
      const sufixo = matrizes === 0 ? 'filtrovali' : 'contratante';
      if (prepararMatriz(tabela, sufixo)) matrizes += 1;
      continue;
    }

    if (/Valor total/i.test(cabecalho) && /Descrição/i.test(cabecalho)) {
      // No modelo de hidrojateamento são duas: ONSHORE e depois OFFSHORE.
      const sufixo = precos === 0 ? 'a' : 'b';
      if (prepararPrecos(tabela, sufixo)) precos += 1;
    }
  }

  return { matrizes, precos };
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

  const tabelas = prepararTabelas(doc);
  prepararEscopo(doc);
  alinharDataDoCabecalho(doc);
  return {
    xml: new XMLSerializer().serializeToString(doc),
    trocados,
    tabelas
  };
}

async function converterArquivo(entrada, saida) {
  const zip = new AdmZip(await readFile(entrada));
  const total = { campos: 0, matrizes: 0, precos: 0 };

  for (const parte of PARTES) {
    const item = zip.getEntry(parte);
    if (!item) continue;
    const { xml, trocados, tabelas } = converterParte(item.getData().toString('utf8'));
    if (!trocados && !tabelas.matrizes && !tabelas.precos) continue;
    zip.updateFile(parte, Buffer.from(xml, 'utf8'));
    total.campos += trocados;
    total.matrizes += tabelas.matrizes;
    total.precos += tabelas.precos;
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
    const r = await converterArquivo(path.join(ORIGEM, nome), destino);
    console.log(
      `${nome} -> ${path.basename(destino)}  ` +
        `(${r.campos} campos, ${r.matrizes} matrizes, ${r.precos} tabelas de preço)`
    );
  }
}

principal().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
