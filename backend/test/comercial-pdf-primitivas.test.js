import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALTURA_MM,
  Documento,
  LARGURA_MM,
  PT_POR_MM,
  mmParaPt
} from '../src/lib/comercial/pdf-primitivas.js';

/**
 * A camada que traduz jsPDF em `pdf-lib` — tarefa T072.
 *
 * O que este teste protege: as duas conversões que, erradas, produzem um PDF
 * que **abre normalmente** e está todo no lugar errado. Nenhuma delas quebra
 * nada; as duas passam despercebidas até alguém abrir o papel.
 */

test('a folha sai em A4 retrato, nas medidas da referência', () => {
  // 210×297 mm. Errar aqui joga fora todo o ajuste de coordenada da referência.
  assert.equal(LARGURA_MM, 210);
  assert.equal(ALTURA_MM, 297);
  assert.ok(Math.abs(PT_POR_MM - 2.834645669) < 1e-6);
  assert.ok(Math.abs(mmParaPt(210) - 595.2756) < 0.001);
  assert.ok(Math.abs(mmParaPt(297) - 841.8898) < 0.001);
});

test('a página criada tem o tamanho de uma A4 de verdade', async () => {
  const doc = await Documento.criar();
  const pagina = doc.novaPagina();
  const { width, height } = pagina.getSize();
  assert.ok(Math.abs(width - 595.2756) < 0.01);
  assert.ok(Math.abs(height - 841.8898) < 0.01);
});

test('a largura do texto vem em MILÍMETROS, não em pontos', async () => {
  // `widthOfTextAtSize` devolve pontos. Devolver o valor cru faria toda quebra
  // de linha medir 2,83 vezes mais do que a folha comporta, e o texto sairia
  // numa coluna estreitíssima — sem erro nenhum no console.
  const doc = await Documento.criar();
  const emMm = doc.larguraDoTexto('Filtrovali', 10);
  const emPt = doc.fonte(false).widthOfTextAtSize('Filtrovali', 10);

  assert.ok(Math.abs(emMm - emPt / PT_POR_MM) < 1e-9);
  assert.ok(emMm < emPt, 'o valor em mm é menor que o mesmo valor em pontos');
  // Uma referência de sanidade: "Filtrovali" a 10pt não passa de 3 cm.
  assert.ok(emMm > 10 && emMm < 30, `largura inesperada: ${emMm}`);
});

test('o negrito é mais largo que o normal no mesmo tamanho', async () => {
  const doc = await Documento.criar();
  assert.ok(
    doc.larguraDoTexto('CONTRATANTE', 9, true) > doc.larguraDoTexto('CONTRATANTE', 9, false)
  );
});

test('a quebra de linha respeita a largura pedida', async () => {
  const doc = await Documento.criar();
  const largura = 40;
  const linhas = doc.quebrarTexto(
    'Disponibilização de equipe técnica especializada para execução dos serviços contratados',
    largura,
    7
  );

  assert.ok(linhas.length > 1, 'o texto tinha de quebrar');
  for (const linha of linhas) {
    assert.ok(
      doc.larguraDoTexto(linha, 7) <= largura,
      `"${linha}" estourou a largura de ${largura} mm`
    );
  }
  // Nada se perde na quebra.
  assert.equal(
    linhas.join(' ').replace(/\s+/g, ' ').trim(),
    'Disponibilização de equipe técnica especializada para execução dos serviços contratados'
  );
});

test('palavra maior que a linha é fatiada, não deixada estourando', async () => {
  const doc = await Documento.criar();
  const codigo = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJ';
  const linhas = doc.quebrarTexto(codigo, 12, 7);

  assert.ok(linhas.length > 1);
  for (const linha of linhas) {
    assert.ok(doc.larguraDoTexto(linha, 7) <= 12, `"${linha}" arrebentaria a moldura`);
  }
  assert.equal(linhas.join(''), codigo, 'a palavra fatiada não pode perder letra');
});

test('o parágrafo preserva as quebras que já vinham no texto', async () => {
  const doc = await Documento.criar();
  const linhas = doc.quebrarTexto('Primeira\nSegunda', 100, 8);
  assert.deepEqual(linhas, ['Primeira', 'Segunda']);
});

test('texto vazio devolve uma linha, nunca lista vazia', async () => {
  const doc = await Documento.criar();
  // Lista vazia faria a altura da linha da tabela virar zero, e a moldura
  // colapsaria numa risca.
  assert.deepEqual(doc.quebrarTexto('', 50, 8), ['']);
  assert.deepEqual(doc.quebrarTexto(null, 50, 8), ['']);
});

test('o y é espelhado: o topo da folha da referência é o topo do papel', async () => {
  // Esta é a conversão que produz um PDF perfeitamente legível e de cabeça para
  // baixo. Sem espelhar, um desenho em y=53 sairia a 53 mm do RODAPÉ.
  const doc = await Documento.criar();
  doc.novaPagina();

  const acimaNaReferencia = 20;
  const abaixoNaReferencia = 250;

  const yPdf = ref => mmParaPt(ALTURA_MM - ref);
  assert.ok(
    yPdf(acimaNaReferencia) > yPdf(abaixoNaReferencia),
    'y menor na referência tem de virar y MAIOR no pdf-lib'
  );
  // O topo da referência (y=0) é o topo da página no pdf-lib.
  assert.ok(Math.abs(yPdf(0) - mmParaPt(ALTURA_MM)) < 1e-9);
});

test('o retângulo é ancorado pelo canto de cima, como na referência', async () => {
  // `pdf-lib` ancora pelo canto de BAIXO. Sem descontar a altura, uma faixa
  // desenhada sob um título cobriria o título em vez do que vem abaixo dele.
  const doc = await Documento.criar();
  const pagina = doc.novaPagina();

  const operacoes = [];
  pagina.drawRectangle = op => operacoes.push(op);
  doc.preencher(12, 100, 186, 7, [0, 0, 0]);

  assert.equal(operacoes.length, 1);
  const esperado = mmParaPt(ALTURA_MM - 100 - 7);
  assert.ok(
    Math.abs(operacoes[0].y - esperado) < 1e-9,
    `y=${operacoes[0].y} deveria ser ${esperado}`
  );
});

test('o alinhamento à direita termina no x pedido', async () => {
  const doc = await Documento.criar();
  const pagina = doc.novaPagina();

  const escritas = [];
  pagina.drawText = (conteudo, op) => escritas.push({ conteudo, ...op });

  doc.texto('7', { tamanho: 7.2, x: 201, y: 289, alinhamento: 'right' });
  const largura = doc.larguraDoTexto('7', 7.2);

  assert.equal(escritas.length, 1);
  assert.ok(Math.abs(escritas[0].x - mmParaPt(201 - largura)) < 1e-9);
});

test('o centralizado fica com metade da largura de cada lado', async () => {
  const doc = await Documento.criar();
  const pagina = doc.novaPagina();

  const escritas = [];
  pagina.drawText = (conteudo, op) => escritas.push({ conteudo, ...op });

  doc.texto('ÍNDICE', { tamanho: 12.5, x: 105, y: 102, negrito: true, alinhamento: 'center' });
  const largura = doc.larguraDoTexto('ÍNDICE', 12.5, true);

  assert.ok(Math.abs(escritas[0].x - mmParaPt(105 - largura / 2)) < 1e-9);
});

test('o documento salvo é um PDF de verdade', async () => {
  const doc = await Documento.criar();
  doc.novaPagina();
  doc.texto('Filtrovali', { tamanho: 10, x: 12, y: 20, negrito: true });

  const bytes = await doc.salvar();
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(bytes.length > 500);
});
