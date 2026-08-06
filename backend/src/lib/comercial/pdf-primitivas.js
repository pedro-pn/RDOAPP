import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * A camada que traduz jsPDF em `pdf-lib` — tarefa T072.
 *
 * **Por que existe.** A referência (`app/proposal-pdf.ts`) desenha o documento
 * inteiro em jsPDF, e cada coordenada dela é um número escolhido a olho contra o
 * papel timbrado: `CONTENT_TOP = 53`, a moldura da tabela em `x = 12`, a largura
 * útil de 186. Reescrever essas contas no sistema do `pdf-lib` seria refazer o
 * ajuste fino inteiro, e errar em silêncio — ninguém revisa um PDF linha a linha.
 *
 * Então este módulo mantém **o mesmo sistema de coordenadas da referência** —
 * milímetros, origem no canto superior esquerdo, y crescendo para BAIXO — e
 * converte só na hora de tocar o `pdf-lib`. Todo número portado continua valendo
 * como está escrito lá.
 *
 * As duas conversões, e as duas são fáceis de errar:
 *
 * 1. **Unidade.** `pdf-lib` fala em pontos PostScript. 1 mm = 72/25,4 pt.
 * 2. **Sentido do y.** `pdf-lib` põe a origem embaixo à esquerda e o y cresce
 *    para cima. Um desenho em y=53 que não fosse espelhado sairia a 53 mm do
 *    RODAPÉ — ou seja, no pé da folha em vez do topo.
 */

/** 1 mm em pontos PostScript. */
export const PT_POR_MM = 72 / 25.4;

/** A4 retrato, nas medidas que a referência usa. */
export const LARGURA_MM = 210;
export const ALTURA_MM = 297;

export const mmParaPt = mm => mm * PT_POR_MM;

/** Cor da referência (0–255 por canal) no formato do `pdf-lib` (0–1). */
export const cor = ([r, g, b]) => rgb(r / 255, g / 255, b / 255);

export const VERDE = [47, 88, 63];
export const AZUL = [35, 61, 101];
export const TINTA = [20, 20, 20];
export const BRANCO = [255, 255, 255];

/**
 * Um documento em construção.
 *
 * Guarda as duas fontes e a página corrente. As fontes são carregadas uma vez —
 * incorporar Helvetica a cada página inflaria o arquivo e é justamente o que o
 * `pdf-lib` evita ao reutilizar a referência incorporada.
 */
export class Documento {
  static async criar() {
    const pdf = await PDFDocument.create();
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    return new Documento(pdf, normal, negrito);
  }

  constructor(pdf, normal, negrito) {
    this.pdf = pdf;
    this.fontes = { normal, negrito };
    this.pagina = null;
  }

  novaPagina() {
    this.pagina = this.pdf.addPage([mmParaPt(LARGURA_MM), mmParaPt(ALTURA_MM)]);
    return this.pagina;
  }

  fonte(negrito) {
    return negrito ? this.fontes.negrito : this.fontes.normal;
  }

  /**
   * Largura do texto em MILÍMETROS.
   *
   * `widthOfTextAtSize` devolve pontos; devolver o valor cru aqui faria toda
   * quebra de linha medir 2,83 vezes mais do que a folha comporta, e o texto
   * sairia numa coluna estreitíssima. É o `pdf.getTextWidth` da referência.
   */
  larguraDoTexto(valor, tamanho, negrito = false) {
    return this.fonte(negrito).widthOfTextAtSize(String(valor ?? ''), tamanho) / PT_POR_MM;
  }

  /**
   * Quebra o texto para caber em `larguraMm` — o `splitTextToSize` da referência.
   *
   * Palavra maior que a linha inteira é **fatiada**, não deixada estourando: um
   * código de peça de 90 caracteres numa célula estreita arrebentaria a moldura
   * da tabela, e no papel não há barra de rolagem para salvar. É a mesma regra
   * de `previaPaginacao.ts`, e tem de ser — a prévia existe para prever isto.
   */
  quebrarTexto(valor, larguraMm, tamanho, negrito = false) {
    const bruto = String(valor ?? '');
    if (!bruto.trim()) return [''];

    const linhas = [];
    for (const paragrafo of bruto.split(/\r?\n/)) {
      const palavras = paragrafo.trim().split(/\s+/).filter(Boolean);
      if (!palavras.length) {
        linhas.push('');
        continue;
      }

      let linha = '';
      for (const palavra of palavras) {
        if (this.larguraDoTexto(palavra, tamanho, negrito) > larguraMm) {
          if (linha) {
            linhas.push(linha);
            linha = '';
          }
          linhas.push(...this.fatiarPalavra(palavra, larguraMm, tamanho, negrito));
          continue;
        }

        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (this.larguraDoTexto(tentativa, tamanho, negrito) <= larguraMm) {
          linha = tentativa;
        } else {
          if (linha) linhas.push(linha);
          linha = palavra;
        }
      }
      if (linha) linhas.push(linha);
    }

    return linhas.length ? linhas : [''];
  }

  fatiarPalavra(palavra, larguraMm, tamanho, negrito) {
    const pedacos = [];
    let atual = '';
    for (const letra of palavra) {
      const tentativa = atual + letra;
      if (atual && this.larguraDoTexto(tentativa, tamanho, negrito) > larguraMm) {
        pedacos.push(atual);
        atual = letra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) pedacos.push(atual);
    return pedacos;
  }

  /**
   * Escreve uma linha de texto na coordenada da referência.
   *
   * `y` é a BASE da letra, medida do topo da folha — como no jsPDF. O
   * espelhamento acontece aqui, num lugar só.
   */
  texto(valor, { tamanho, x, y, negrito = false, alinhamento = 'left', tinta = TINTA }) {
    const conteudo = String(valor ?? '');
    if (!conteudo) return;

    const largura = this.larguraDoTexto(conteudo, tamanho, negrito);
    const xFinal =
      alinhamento === 'center' ? x - largura / 2 : alinhamento === 'right' ? x - largura : x;

    this.pagina.drawText(conteudo, {
      x: mmParaPt(xFinal),
      y: mmParaPt(ALTURA_MM - y),
      size: tamanho,
      font: this.fonte(negrito),
      color: cor(tinta)
    });
  }

  /** Várias linhas a partir de `y`, descendo `alturaDaLinha` a cada uma. */
  textoEmLinhas(
    linhas,
    { tamanho, x, y, alturaDaLinha, negrito = false, tinta = TINTA, alinhamento = 'left' }
  ) {
    linhas.forEach((linha, i) => {
      this.texto(linha, {
        tamanho,
        x,
        y: y + i * alturaDaLinha,
        negrito,
        tinta,
        alinhamento
      });
    });
    return y + linhas.length * alturaDaLinha;
  }

  /** Marcador redondo — o `pdf.circle` da referência, usado nos itens do 1.1. */
  circulo(x, y, raio, tinta) {
    this.pagina.drawCircle({
      x: mmParaPt(x),
      y: mmParaPt(ALTURA_MM - y),
      size: mmParaPt(raio),
      color: cor(tinta)
    });
  }

  /** Retângulo preenchido, na coordenada da referência (canto superior esquerdo). */
  preencher(x, y, largura, altura, tinta) {
    this.pagina.drawRectangle({
      x: mmParaPt(x),
      // O `pdf-lib` ancora o retângulo pelo canto INFERIOR esquerdo: usar
      // `ALTURA_MM - y` sem descontar a altura desenharia o bloco para cima,
      // cobrindo o que está acima em vez do que está abaixo.
      y: mmParaPt(ALTURA_MM - y - altura),
      width: mmParaPt(largura),
      height: mmParaPt(altura),
      color: cor(tinta)
    });
  }

  /** Moldura sem preenchimento. */
  contornar(x, y, largura, altura, tinta = [55, 55, 55], espessura = 0.2) {
    this.pagina.drawRectangle({
      x: mmParaPt(x),
      y: mmParaPt(ALTURA_MM - y - altura),
      width: mmParaPt(largura),
      height: mmParaPt(altura),
      borderColor: cor(tinta),
      borderWidth: espessura
    });
  }

  linha(x1, y1, x2, y2, tinta = [40, 40, 40], espessura = 0.3) {
    this.pagina.drawLine({
      start: { x: mmParaPt(x1), y: mmParaPt(ALTURA_MM - y1) },
      end: { x: mmParaPt(x2), y: mmParaPt(ALTURA_MM - y2) },
      color: cor(tinta),
      thickness: espessura
    });
  }

  /** Imagem já incorporada (`pdf.embedJpg`), na coordenada da referência. */
  imagem(incorporada, x, y, largura, altura) {
    this.pagina.drawImage(incorporada, {
      x: mmParaPt(x),
      y: mmParaPt(ALTURA_MM - y - altura),
      width: mmParaPt(largura),
      height: mmParaPt(altura)
    });
  }

  async salvar() {
    return Buffer.from(await this.pdf.save());
  }
}
