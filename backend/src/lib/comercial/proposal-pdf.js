import {
  INDICE_COMERCIAL,
  INDICE_TECNICO,
  LINHAS_ASSINATURA,
  NOTA_ATENDIMENTO_MONTADORA,
  NOTA_ATENDIMENTO_REVALIDACAO,
  NOTA_PRAZO_DESLOCAMENTO,
  TEXTO_ACEITE,
  TEXTO_EXPLICACAO_STANDBY,
  TEXTO_IMPOSTOS,
  TEXTO_OBSERVACOES_GERAIS,
  TEXTO_PRAZOS_CRONOGRAMA,
  TEXTO_PROPRIEDADE_INTELECTUAL,
  TITULO_BLOCO_STANDBY,
  fraseHoraExtra,
  linhasDePrazo,
  observacoesTecnicasDoModelo,
  tabelaStandby,
  tabelasDePrecoDoModelo,
  textoJornada
} from '../../../../shared/comercial/dist/modelo-documento.js';
import { buildTechnicalReportsText } from '../../../../shared/comercial/dist/technical-services.js';
import {
  ALTURA_MM,
  AZUL,
  BRANCO,
  Documento,
  LARGURA_MM,
  VERDE
} from './pdf-primitivas.js';
import { carregarImagens } from './pdf-imagens.js';

/**
 * SUPERADO pelo caminho do modelo `.docx` (`proposta-docx.js`), decidido em
 * 06/08. A rota de prévia não usa mais este arquivo.
 *
 * Fica aqui porque o porte 1:1 das primitivas de jsPDF para `pdf-lib` é a única
 * coisa no repositório que sabe desenhar o documento sem depender do
 * LibreOffice, e apagá-lo é decisão do mantenedor, não minha. **Não mexa nos
 * dois:** duas maneiras de desenhar a mesma proposta divergem em silêncio, e o
 * cliente recebe a que ninguém revisou.
 *
 * O gerador dos dois documentos — tarefa T072.
 *
 * Porte de `app/proposal-pdf.ts` (jsPDF) para `pdf-lib`. **As coordenadas são as
 * mesmas, linha por linha**: `pdf-primitivas.js` mantém milímetros com y para
 * baixo justamente para que cada número portado continue valendo como está
 * escrito na referência. Ver o cabeçalho daquele arquivo.
 *
 * O que NÃO veio da referência é o texto fixo — ele vem de
 * `shared/comercial/modelo-documento.js`, extraído dos `.docx`. É o desvio 12:
 * onde o código da referência e o documento divergem, o documento vence, porque
 * é ele que vai ao cliente. A referência é a autoridade sobre o LAYOUT; o `.docx`
 * é a autoridade sobre o CONTEÚDO.
 */

const TAMANHO_DO_CORPO = 8.1;
const ALTURA_DA_LINHA = 3.8;
const TOPO_DO_CONTEUDO = 53;
const PE_DO_CONTEUDO = 269;

/** A largura útil entre as margens da referência: de x=12 a x=198. */
const LARGURA_UTIL = 186;

/**
 * O quanto a folha de identificação desce em relação à referência.
 *
 * Lá o conteúdo dela começa em y=16 porque um retângulo cinza cobria o
 * cabeçalho. Sem esse retângulo — ele apagava a marca e deixava uma faixa
 * visível —, o texto precisa começar abaixo da curva verde, que termina a
 * 48 mm do topo. Medido na imagem do timbrado, não estimado.
 */
const RECUO_DA_IDENTIFICACAO = 37;

const SERVICOS_INSTITUCIONAIS = [
  'Limpeza química de tubulações e reservatórios (decapagem e passivação)',
  'Flushing secundário',
  'Filtragem absoluta',
  'Centrifugação e desidratação de óleo',
  'Flushing primário',
  'Passagem de PIG de espuma',
  'Teste de pressão (teste hidrostático)'
];

/**
 * A data por extenso do cabeçalho.
 *
 * Meio-dia em UTC, como na referência, e não é capricho: `new Date("2026-01-07")`
 * é meia-noite UTC, que em Brasília ainda é dia 6 — a data do documento voltaria
 * um dia para todo mundo a oeste de Greenwich.
 */
function formatarData(iso) {
  const bruto = String(iso || '').trim();
  if (!bruto) return '';
  const quando = new Date(`${bruto}T12:00:00Z`);
  if (Number.isNaN(quando.getTime())) return bruto;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    quando
  );
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0
  );
}

/**
 * Desfaz a máscara de moeda.
 *
 * Ponto é separador de milhar e vírgula é decimal, ao contrário do que `Number`
 * espera. Ler "R$ 11.250,00" com `Number` daria `NaN`, e `NaN` formatado sai
 * como "R$ NaN" impresso na proposta.
 */
function lerDinheiro(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '');
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * O estado da renderização.
 *
 * `y` não mora aqui de propósito: cada função devolve o y onde parou, como na
 * referência. Guardar o cursor no contexto tornaria invisível quem o move, e é
 * justamente o encadeamento de `y` que faz a quebra de página funcionar.
 */
class Renderizacao {
  constructor(doc, imagens, dados) {
    this.doc = doc;
    this.imagens = imagens;
    this.dados = dados;
    this.numeroDaPagina = 0;
  }

  /** Nova folha com o timbrado, a data no topo e o número no pé. */
  folhaTimbrada() {
    const { doc, imagens, dados } = this;
    doc.novaPagina();
    this.numeroDaPagina += 1;
    doc.imagem(imagens.timbrado, 0, 0, LARGURA_MM, ALTURA_MM);
    doc.texto(formatarData(dados.date), {
      tamanho: 8.5,
      x: 185,
      y: 16,
      negrito: true,
      alinhamento: 'right'
    });
    doc.texto(String(this.numeroDaPagina), {
      tamanho: 7.2,
      x: 201,
      y: 289,
      alinhamento: 'right'
    });
    return TOPO_DO_CONTEUDO;
  }

  /**
   * A folha de identificação.
   *
   * A referência pintava um retângulo cinza sobre os 48 mm do topo para poder
   * escrever a partir de y=16 — ou seja, **por cima do cabeçalho**. No timbrado
   * daqui isso apaga a curva verde e o logotipo e deixa uma faixa cinza que
   * termina no meio da folha, que foi o que apareceu no papel.
   *
   * Então não se pinta nada: o cabeçalho fica visível como em toda folha, e o
   * conteúdo começa abaixo dele. Todas as coordenadas desta página descem
   * `RECUO_DA_IDENTIFICACAO` por causa disso.
   */
  folhaDeIdentificacao() {
    const { doc, imagens } = this;
    doc.novaPagina();
    this.numeroDaPagina += 1;
    doc.imagem(imagens.timbrado, 0, 0, LARGURA_MM, ALTURA_MM);
    doc.texto(String(this.numeroDaPagina), {
      tamanho: 7.2,
      x: 201,
      y: 289,
      alinhamento: 'right'
    });
    return 16 + RECUO_DA_IDENTIFICACAO;
  }

  titulo(valor, y) {
    this.doc.texto(valor, { tamanho: 11, x: 12, y, negrito: true });
    return y + 7;
  }

  /** Parágrafo simples, sem quebra de página — o `paragraph` da referência. */
  paragrafo(valor, y) {
    const linhas = this.doc.quebrarTexto(valor || '-', 176, TAMANHO_DO_CORPO);
    this.doc.textoEmLinhas(linhas, {
      tamanho: TAMANHO_DO_CORPO,
      x: 17,
      y,
      alturaDaLinha: ALTURA_DA_LINHA
    });
    return y + linhas.length * ALTURA_DA_LINHA + 5;
  }

  /**
   * Texto corrido que **atravessa páginas**.
   *
   * A capacidade é recalculada a cada pedaço porque a folha nova recomeça do
   * topo. Calcular uma vez só faria o segundo pedaço usar a capacidade da folha
   * anterior e transbordar para fora do papel — sem erro nenhum, só texto
   * cortado.
   */
  fluir(valor, y) {
    let cursor = y;
    const paragrafos = String(valor || '-')
      .split(/\n+/)
      .map(item => item.trim())
      .filter(Boolean);

    for (const paragrafo of paragrafos) {
      const linhas = this.doc.quebrarTexto(paragrafo, 181, TAMANHO_DO_CORPO);
      let restantes = linhas;
      while (restantes.length) {
        const capacidade = Math.max(
          1,
          Math.floor((PE_DO_CONTEUDO - cursor) / ALTURA_DA_LINHA)
        );
        const pedaco = restantes.slice(0, capacidade);
        restantes = restantes.slice(capacidade);
        this.doc.textoEmLinhas(pedaco, {
          tamanho: TAMANHO_DO_CORPO,
          x: 17,
          y: cursor,
          alturaDaLinha: ALTURA_DA_LINHA
        });
        cursor += pedaco.length * ALTURA_DA_LINHA + 3;
        if (restantes.length || cursor > PE_DO_CONTEUDO - 4) cursor = this.folhaTimbrada();
      }
    }
    return cursor + 2;
  }

  secao(tituloTexto, valor, y) {
    let cursor = y;
    if (cursor > PE_DO_CONTEUDO - 18) cursor = this.folhaTimbrada();
    cursor = this.titulo(tituloTexto, cursor);
    return this.fluir(valor, cursor);
  }

  /** Rótulo em negrito e valor ao lado — o bloco de identificação do cliente. */
  linhaRotulada(rotulo, valor, y, tamanho = 9.5, valorEmNegrito = false) {
    this.doc.texto(rotulo, { tamanho, x: 12, y, negrito: true });
    const deslocamento = this.doc.larguraDoTexto(rotulo, tamanho, true) + 2;
    this.doc.texto(valor || '-', {
      tamanho,
      x: 12 + deslocamento,
      y,
      negrito: valorEmNegrito
    });
    return y + 5.7;
  }

  /**
   * Uma linha de tabela com moldura.
   *
   * A segunda coluna é a única alinhada à esquerda — é a de texto. As demais
   * são número e nota curta, e ficam centradas, como na referência.
   */
  linhaDeTabela(celulas, larguras, y, cabecalho, altura, corDoCabecalho) {
    let x = 12;
    if (cabecalho) {
      const total = larguras.reduce((soma, largura) => soma + largura, 0);
      this.doc.preencher(x, y, total, altura, corDoCabecalho);
    }
    celulas.forEach((celula, i) => {
      this.doc.contornar(x, y, larguras[i], altura);
      const linhas = Array.isArray(celula) ? celula : [celula];
      const tamanho = cabecalho ? 7.2 : 6.8;
      const aEsquerda = i === 1;
      this.doc.textoEmLinhas(linhas, {
        tamanho,
        x: aEsquerda ? x + 1.5 : x + larguras[i] / 2,
        y: y + 4,
        alturaDaLinha: 3.4,
        negrito: cabecalho,
        tinta: cabecalho ? BRANCO : [20, 20, 20],
        ...(aEsquerda ? {} : { alinhamento: 'center' })
      });
      x += larguras[i];
    });
    return y + altura;
  }

  visualCentralizado(visual, y, largura) {
    const altura = largura / visual.proporcao;
    this.doc.imagem(visual.imagem, (LARGURA_MM - largura) / 2, y, largura, altura);
    return y + altura;
  }

  /** Uma fila de imagens dividindo a largura útil, alinhadas pela base. */
  faixaDeVisuais(visuais, y, alturaPedida, espaco) {
    if (!visuais.length) return y;
    const larguraDeCada = (LARGURA_UTIL - espaco * (visuais.length - 1)) / visuais.length;
    let x = 12;
    let maiorAltura = 0;
    for (const visual of visuais) {
      const altura = Math.min(alturaPedida, larguraDeCada / visual.proporcao);
      const largura = altura * visual.proporcao;
      this.doc.imagem(visual.imagem, x + (larguraDeCada - largura) / 2, y, largura, altura);
      maiorAltura = Math.max(maiorAltura, altura);
      x += larguraDeCada + espaco;
    }
    return y + maiorAltura;
  }
}

// ---------------------------------------------------------------------------
// As páginas
// ---------------------------------------------------------------------------

function paginaDeIdentificacao(r, titulo, indice) {
  const { doc, dados } = r;
  let y = r.folhaDeIdentificacao();
  doc.texto(titulo, { tamanho: 13.5, x: 105, y, negrito: true, alinhamento: 'center' });

  y = 34 + RECUO_DA_IDENTIFICACAO;
  y = r.linhaRotulada('Consultor de Vendas:', dados.seller, y, 9.5, true);
  y = r.linhaRotulada('Orçamentista:', dados.estimator, y, 9.5);
  y += 4;
  y = r.linhaRotulada('PROPOSTA Nº:', numeroDaProposta(dados), y, 10.2, true);
  y = r.linhaRotulada('CLIENTE:', dados.client, y, 10.2, true);
  y = r.linhaRotulada('A/C:', dados.contact, y, 9.5);
  y = r.linhaRotulada('E-mail do solicitante:', dados.email, y, 9.5);
  y = r.linhaRotulada('Departamento:', dados.department || '-', y, 9.5);
  y += 4;
  y = r.linhaRotulada('Local da obra:', dados.site, y, 9.5, true);
  y += 4;
  r.linhaRotulada('CNPJ:', dados.cnpj, y, 9.5, true);

  doc.texto('ÍNDICE', {
    tamanho: 12.5,
    x: 105,
    y: 102 + RECUO_DA_IDENTIFICACAO,
    negrito: true,
    alinhamento: 'center'
  });
  // O comercial tem treze itens e o técnico dez: apertar o espaçamento no maior
  // é o que impede o índice de invadir a próxima seção.
  const espacamento = indice.length > 11 ? 7.2 : 8.3;
  indice.forEach((item, i) => {
    doc.texto(`${i + 1}.  ${item}`, {
      tamanho: 8.1,
      x: 17,
      y: 116 + RECUO_DA_IDENTIFICACAO + i * espacamento,
      negrito: true
    });
  });
}

function numeroDaProposta(dados) {
  const revisao = String(dados.revision || '').trim();
  const codigo = String(dados.proposalCode || '');
  if (!revisao || /rev(?:is[aã]o)?\b/i.test(codigo)) return codigo;
  return `${codigo} REV. ${revisao}`;
}

function paginaInstitucional(r) {
  const { imagens } = r;
  let y = r.folhaTimbrada();
  y = r.titulo('1. Filtrovali é a escolha certa para a sua obra', y);
  y = r.paragrafo(
    'São 21 anos de história e entregas de soluções industriais, com excelência, segurança, qualidade e eficiência.',
    y
  );
  y = r.visualCentralizado(imagens.metricas, y + 2, 170);
  y += 7;
  y = r.titulo('1.1 Tradição, excelência e referência em serviços industriais', y);

  // Duas colunas, como no documento: quatro à esquerda e três à direita.
  const coluna = (itens, xMarcador, larguraDoTexto) => {
    let cursor = y;
    for (const servico of itens) {
      const linhas = r.doc.quebrarTexto(servico, larguraDoTexto, 7.4);
      r.doc.circulo(xMarcador, cursor - 1, 0.75, VERDE);
      r.doc.textoEmLinhas(linhas, {
        tamanho: 7.4,
        x: xMarcador + 5,
        y: cursor,
        alturaDaLinha: 3.35
      });
      cursor += Math.max(5.2, linhas.length * 3.35 + 2);
    }
    return cursor;
  };
  const esquerda = coluna(SERVICOS_INSTITUCIONAIS.slice(0, 4), 27, 78);
  const direita = coluna(SERVICOS_INSTITUCIONAIS.slice(4), 116, 75);

  y = Math.max(esquerda, direita) + 2;
  y = r.faixaDeVisuais(imagens.galeriaDeServicos, y, 40, 3);
  y += 8;
  y = r.titulo('1.2 Equipamentos modernos, revisados e de alto desempenho', y);
  r.faixaDeVisuais(imagens.galeriaDeEquipamentos, y + 1, 36, 3);
}

function paginaDeEscopo(r) {
  const { dados, imagens } = r;
  let y = r.folhaTimbrada();
  y = r.titulo('1.3 Clientes que confiam e atestam a excelência da Filtrovali', y);
  y = r.visualCentralizado(imagens.clientes, y + 1, 154);
  y += 8;
  y = r.titulo('2. Descrição dos serviços que serão executados', y);

  const itens = Array.isArray(dados.scopeItems) ? dados.scopeItems : [];
  if (!itens.length) {
    y = r.fluir(dados.serviceDescription || dados.scope || '-', y);
  } else {
    itens.forEach((item, i) => {
      if (y > PE_DO_CONTEUDO - 18) y = r.folhaTimbrada();
      r.doc.texto(`2.${i + 1} - ${item.title || `Serviço ${i + 1}`}`, {
        tamanho: 10,
        x: 17,
        y,
        negrito: true
      });
      y = r.fluir(item.description || 'Serviço conforme escopo apresentado.', y + 6);
    });
  }
  return y;
}

/**
 * A matriz de responsabilidade, com as categorias do `.docx`.
 *
 * A referência desenha uma tabela plana; o documento agrupa as linhas sob
 * subtítulos que ocupam a largura da tabela. É o desvio 12 — a categoria vira
 * uma faixa própria, e ela **se repete** quando o grupo atravessa a folha, senão
 * as linhas da página seguinte apareceriam sob cabeçalho nenhum.
 */
function grupoDeResponsabilidade(r, titulo, responsavel, linhas, yInicial) {
  let y = yInicial;
  const larguras = [14, 130, 42];
  const corDoGrupo = responsavel === 'Filtrovali' ? VERDE : AZUL;

  if (y > PE_DO_CONTEUDO - 16) y = r.folhaTimbrada();

  let categoriaAberta = '';
  const desenharCabecalho = () => {
    r.doc.preencher(12, y, LARGURA_UTIL, 7, corDoGrupo);
    r.doc.texto(titulo, {
      tamanho: 8.3,
      x: 105,
      y: y + 4.8,
      negrito: true,
      alinhamento: 'center',
      tinta: BRANCO
    });
    y += 7;
    y = r.linhaDeTabela(['ITEM', 'ESCOPO', 'NOTA'], larguras, y, true, 7, corDoGrupo);
  };

  const desenharCategoria = (texto, continuacao) => {
    r.doc.preencher(12, y, LARGURA_UTIL, 5, [232, 240, 235]);
    r.doc.contornar(12, y, LARGURA_UTIL, 5);
    r.doc.texto(continuacao ? `${texto} (continuação)` : texto, {
      tamanho: 6.8,
      x: 14,
      y: y + 3.4,
      negrito: true,
      tinta: [33, 75, 53]
    });
    y += 5;
  };

  desenharCabecalho();

  const comItem = linhas.length
    ? linhas
    : [{ item: 'Sem itens cadastrados.', note: '', categoria: '' }];

  comItem.forEach((linha, indice) => {
    const categoria = String(linha.categoria || '').trim();
    const abre = categoria && categoria !== categoriaAberta;

    const celulas = [
      String(indice + 1),
      linha.item,
      linha.note || '',
      ...(linha.subitens || []).map(sub => `• ${sub}`)
    ];
    const escopo = [
      ...r.doc.quebrarTexto(linha.item, larguras[1] - 3, 6.8),
      ...(linha.subitens || []).flatMap(sub =>
        r.doc.quebrarTexto(`• ${sub}`, larguras[1] - 5, 6.8)
      )
    ];
    const quebradas = [
      r.doc.quebrarTexto(celulas[0], larguras[0] - 3, 6.8),
      escopo,
      r.doc.quebrarTexto(celulas[2], larguras[2] - 3, 6.8)
    ];
    const altura = Math.max(7, Math.max(...quebradas.map(l => l.length)) * 3.4 + 2);

    if (y + altura + (abre ? 5 : 0) > PE_DO_CONTEUDO) {
      y = r.folhaTimbrada();
      desenharCabecalho();
      if (categoria) desenharCategoria(categoria, !abre);
    } else if (abre) {
      desenharCategoria(categoria, false);
    }
    if (categoria) categoriaAberta = categoria;

    y = r.linhaDeTabela(quebradas, larguras, y, false, altura, corDoGrupo);
  });

  return y;
}

function paginaDeResponsabilidades(r, y) {
  let cursor = y;
  if (cursor > PE_DO_CONTEUDO - 40) cursor = r.folhaTimbrada();
  cursor = r.titulo('3. Matriz geral de responsabilidade', cursor);

  const linhas = Array.isArray(r.dados.rows) ? r.dados.rows : [];
  cursor = grupoDeResponsabilidade(
    r,
    '3.1 Responsabilidade da Filtrovali',
    'Filtrovali',
    linhas.filter(linha => linha.owner === 'Filtrovali'),
    cursor
  );
  return grupoDeResponsabilidade(
    r,
    '3.2 Responsabilidade da Contratante',
    'Contratante',
    linhas.filter(linha => linha.owner === 'Contratante'),
    cursor + 5
  );
}

function paginaDePrazos(r) {
  const { dados } = r;
  let y = r.folhaTimbrada();

  y = r.titulo('4. Previsão de atendimento', y);
  y = r.paragrafo(
    `${dados.attendance || 'A definir'} após o recebimento do pedido de compras ou assinatura do contrato.`,
    y
  );
  y = r.fluir(NOTA_ATENDIMENTO_MONTADORA, y);
  y = r.fluir(NOTA_ATENDIMENTO_REVALIDACAO, y);

  y = r.titulo('5. Prazo para execução dos serviços', y + 2);
  y = r.fluir(TEXTO_PRAZOS_CRONOGRAMA, y);
  for (const linha of linhasDePrazo({
    permanencia: dados.permanence || 'a definir',
    integracao: dados.integration || 'a definir',
    execucao: dados.execution || 'a definir',
    deslocamento: dados.mobilization || 'a definir'
  })) {
    y = r.paragrafo(linha, y);
  }
  y = r.fluir(NOTA_PRAZO_DESLOCAMENTO, y);

  y = r.titulo('6. Jornada de trabalho', y + 2);
  return r.fluir(dados.workday || textoJornada(dados.modelo || 'padrao'), y);
}

/**
 * A tabela de preços.
 *
 * O modelo de hidrojateamento traz **duas**, ONSHORE e OFFSHORE, cada uma com o
 * seu TOTAL GERAL. Somá-las num total só apresentaria ao cliente um número que
 * ele não vai pagar: são cenários alternativos de execução, não parcelas do
 * mesmo serviço.
 */
function tabelaDePrecos(r, itens, incluirUnitario, yInicial) {
  let y = yInicial;
  const larguras = incluirUnitario ? [13, 91, 24, 18, 40] : [13, 111, 28, 34];
  const cabecalhos = incluirUnitario
    ? ['ITEM', 'DESCRIÇÃO', 'VALOR UNIT.', 'QTD.', 'VALOR TOTAL']
    : ['ITEM', 'DESCRIÇÃO', 'QTD.', 'VALOR'];

  const desenharCabecalho = () => {
    y = r.linhaDeTabela(cabecalhos, larguras, y, true, 8, AZUL);
  };
  desenharCabecalho();

  itens.forEach((item, indice) => {
    const celulas = incluirUnitario
      ? [
          String(indice + 1),
          item.description,
          item.unitValue || 'R$ -',
          item.quantity || '1',
          item.value || 'R$ -'
        ]
      : [String(indice + 1), item.description, item.quantity || '1', item.value || 'R$ -'];
    const quebradas = celulas.map((celula, i) =>
      r.doc.quebrarTexto(celula || '-', larguras[i] - 3, 6.8)
    );
    const altura = Math.max(8, Math.max(...quebradas.map(l => l.length)) * 3.7 + 2);

    if (y + altura > PE_DO_CONTEUDO - 10) {
      y = r.folhaTimbrada();
      desenharCabecalho();
    }
    y = r.linhaDeTabela(quebradas, larguras, y, false, altura, AZUL);
  });

  const total = itens.reduce((soma, item) => soma + lerDinheiro(item.value), 0);
  r.doc.preencher(12, y, LARGURA_UTIL, 8, [229, 236, 242]);
  r.doc.contornar(12, y, LARGURA_UTIL, 8, [50, 50, 50]);
  r.doc.texto('TOTAL GERAL', { tamanho: 8.2, x: 15, y: y + 5.3, negrito: true });
  r.doc.texto(formatarMoeda(total), {
    tamanho: 8.2,
    x: 195,
    y: y + 5.3,
    negrito: true,
    alinhamento: 'right'
  });
  return y + 8;
}

function secoesComerciais(r) {
  const { dados } = r;
  let y = r.folhaTimbrada();
  y = r.titulo('7. Descrição dos valores', y);

  const itens = Array.isArray(dados.prices) ? dados.prices : [];
  const locais = tabelasDePrecoDoModelo(dados.modelo || 'padrao');
  if (locais) {
    for (const local of locais) {
      if (y > PE_DO_CONTEUDO - 30) y = r.folhaTimbrada();
      r.doc.texto(`${local}:`, { tamanho: 9, x: 12, y, negrito: true });
      y = tabelaDePrecos(
        r,
        itens.filter(item => item.local === local),
        dados.includeUnitValue,
        y + 5
      );
      y += 6;
    }
  } else {
    y = tabelaDePrecos(r, itens, dados.includeUnitValue, y);
  }

  y = r.secao('8. Condições de pagamento', dados.payment, y + 8);

  // Item 9 intercala prosa e tabela: frase da hora extra, título do bloco, a
  // TABELA, e só então a explicação. A explicação diz "conforme a tabela acima",
  // então a ordem não é detalhe de diagramação.
  if (y > PE_DO_CONTEUDO - 40) y = r.folhaTimbrada();
  y = r.titulo('9. Observações', y + 2);
  y = r.fluir(fraseHoraExtra(lerDinheiro(dados.overtimeRate)), y);
  r.doc.texto(TITULO_BLOCO_STANDBY, { tamanho: 8.6, x: 17, y, negrito: true });
  y += 6;
  y = tabelaDeStandby(r, dados, y);
  y = r.fluir(TEXTO_EXPLICACAO_STANDBY, y + 4);
  y = r.fluir(dados.observations || TEXTO_OBSERVACOES_GERAIS, y);

  y = r.secao('10. Impostos', dados.taxes || TEXTO_IMPOSTOS, y + 2);
  y = r.secao('11. Validade da proposta', `${dados.validity || '10'} dias após a emissão.`, y + 2);
  y = r.secao('12. Proteção à propriedade intelectual e know-how', TEXTO_PROPRIEDADE_INTELECTUAL, y + 2);

  y = r.folhaTimbrada();
  y = r.titulo('13. Aceite e assinatura da proposta', y);
  y = r.fluir(TEXTO_ACEITE, y);
  for (const linha of LINHAS_ASSINATURA) {
    r.doc.texto(linha, { tamanho: 10, x: 105, y: y + 8, alinhamento: 'center' });
    y += 8;
  }
}

function tabelaDeStandby(r, dados, yInicial) {
  let y = yInicial;
  const larguras = [124, 62];
  y = r.linhaDeTabela(['ITEM', 'VALOR'], larguras, y, true, 7, AZUL);
  const linhas = tabelaStandby({
    horaExtra: lerDinheiro(dados.overtimeRate),
    standbyEquipe: lerDinheiro(dados.standbyTeam),
    standbyEquipamento: lerDinheiro(dados.standbyEquipment),
    mobilizacaoExtra: lerDinheiro(dados.extraMobilization)
  });
  for (const [rotulo, valor] of linhas) {
    // A primeira coluna aqui é texto, mas `linhaDeTabela` alinha à esquerda só a
    // SEGUNDA. Passar o rótulo já quebrado mantém a moldura, e a centralização
    // não incomoda numa tabela de duas colunas curtas.
    y = r.linhaDeTabela(
      [r.doc.quebrarTexto(rotulo, larguras[0] - 3, 6.8), [valor]],
      larguras,
      y,
      false,
      7,
      AZUL
    );
  }
  return y;
}

function secoesTecnicas(r) {
  const { dados } = r;
  let y = r.folhaTimbrada();
  y = r.titulo('7. Escopo técnico', y);

  const servicos = Array.isArray(dados.technicalServices) ? dados.technicalServices : [];
  if (servicos.length) {
    servicos.forEach((servico, i) => {
      if (y > PE_DO_CONTEUDO - 18) y = r.folhaTimbrada();
      r.doc.texto(`7.${i + 1} - ${servico.title}`, { tamanho: 10, x: 17, y, negrito: true });
      y = r.fluir(servico.text, y + 6);
    });
    y = r.secao(
      '8. Relatórios',
      buildTechnicalReportsText(servicos, dados.technicalReports || ''),
      y + 3
    );
  } else {
    y = r.fluir('Escopo técnico a definir.', y);
    y = r.secao('8. Relatórios', dados.technicalReports || '-', y + 3);
  }

  y = r.secao('9. Validade da proposta', `${dados.validity || '10'} dias após a emissão.`, y + 2);
  r.secao(
    '10. Observações',
    [observacoesTecnicasDoModelo(dados.modelo || 'padrao'), dados.technicalObservations]
      .filter(item => String(item || '').trim())
      .join('\n\n'),
    y + 2
  );
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

async function montar(dados, tipo) {
  const doc = await Documento.criar();
  const imagens = await carregarImagens(doc.pdf, tipo);
  const r = new Renderizacao(doc, imagens, dados);

  const comercial = tipo === 'commercial';

  // A capa é só imagem, sem texto por cima — e conta como página 1.
  doc.novaPagina();
  r.numeroDaPagina += 1;
  doc.imagem(imagens.capa, 0, 0, LARGURA_MM, ALTURA_MM);

  paginaDeIdentificacao(
    r,
    comercial ? 'Proposta Comercial' : 'Proposta Técnica',
    comercial ? [...INDICE_COMERCIAL] : [...INDICE_TECNICO]
  );
  paginaInstitucional(r);
  const depoisDoEscopo = paginaDeEscopo(r);
  paginaDeResponsabilidades(r, depoisDoEscopo + 4);
  paginaDePrazos(r);

  if (comercial) secoesComerciais(r);
  else secoesTecnicas(r);

  return doc.salvar();
}

export function gerarPropostaComercial(dados) {
  return montar(dados, 'commercial');
}

export function gerarPropostaTecnica(dados) {
  return montar(dados, 'technical');
}
