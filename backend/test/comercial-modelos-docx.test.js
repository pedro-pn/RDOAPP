import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import { repetirLinha, replacePlaceholders } from '../src/lib/docx/template.js';

/**
 * Os modelos `.docx` das propostas.
 *
 * Eles são **gerados** por `scripts/comercial-gerar-modelos.mjs` a partir dos
 * documentos preenchidos que o comercial entrega. Este teste é o contrato entre
 * o gerador e o preenchimento: se um marcador some do modelo, o campo
 * correspondente desaparece do documento que vai ao cliente — sem erro nenhum,
 * porque um `.docx` com uma célula vazia abre perfeitamente.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEM = path.resolve(AQUI, '../../Modelos/definitivos/Comercial');
const MODELOS = process.env.COMERCIAL_MODELOS_DIR
  ? path.resolve(process.env.COMERCIAL_MODELOS_DIR)
  : path.resolve(AQUI, '../../Modelos/definitivos/Comercial/modelos');

const ARQUIVOS = {
  comercial: 'Proposta Comercial.docx',
  tecnica: 'Proposta técnica.docx',
  comercialHidro: 'Proposta comercial hidrojateamento.docx',
  tecnicaHidro: 'Proposta técnica hidrojateamento.docx'
};

async function documentoDe(arquivo) {
  const zip = new AdmZip(await readFile(path.join(MODELOS, arquivo)));
  const xml = zip.getEntry('word/document.xml').getData().toString('utf8');
  return { xml, doc: new DOMParser().parseFromString(xml, 'text/xml') };
}

const marcadoresDe = xml => new Set([...xml.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]));

/** Os campos do cabeçalho, iguais nos quatro documentos. */
const CABECALHO = [
  'nome_vendedor',
  'elaborador_proposta',
  'cod_prop',
  'nome_cliente',
  'contato_cliente',
  'email_cliente',
  'dpto_solicitante',
  'local_obra',
  'cnpj_texto',
  'prev_atende',
  'n_dias',
  'dias_treinamento',
  'n_dias_trabalhados',
  'dias_mob',
  'validadeProp'
];

test('os quatro modelos trazem os campos do cabeçalho', async () => {
  for (const arquivo of Object.values(ARQUIVOS)) {
    const { xml } = await documentoDe(arquivo);
    const marcadores = marcadoresDe(xml);
    for (const campo of CABECALHO) {
      assert.ok(marcadores.has(campo), `${arquivo}: falta {{${campo}}}`);
    }
  }
});

test('nenhum modelo guarda dado da negociação de exemplo', async () => {
  // Os documentos vieram preenchidos com uma proposta real. Um valor esquecido
  // sairia impresso na proposta de outro cliente.
  const vazamentos = ['Lucas Silva', 'MIP ENGENHARIA', 'Luciano Salazar', '33.193.996'];
  for (const arquivo of Object.values(ARQUIVOS)) {
    const { xml } = await documentoDe(arquivo);
    for (const valor of vazamentos) {
      assert.ok(!xml.includes(valor), `${arquivo}: sobrou "${valor}"`);
    }
  }
});

test('nenhum modelo guarda campo de mala direta', async () => {
  // MERGEFIELD sobrando significa campo que o preenchimento não alcança: o Word
  // mostraria o valor em cache da proposta de exemplo.
  for (const arquivo of Object.values(ARQUIVOS)) {
    const { xml } = await documentoDe(arquivo);
    assert.ok(!/MERGEFIELD/.test(xml), `${arquivo}: sobrou campo de mala direta`);
  }
});

test('os modelos técnicos não carregam o catálogo fixo do capítulo 7', async () => {
  for (const arquivo of [ARQUIVOS.tecnica, ARQUIVOS.tecnicaHidro]) {
    const { doc } = await documentoDe(arquivo);
    const paragrafos = [...doc.getElementsByTagName('w:p')].map(paragrafo =>
      [...paragrafo.getElementsByTagName('w:t')].map(texto => texto.textContent || '').join('')
    );
    const inicio = paragrafos.findIndex(texto => texto.includes('- Escopo Técnico:'));
    const fim = paragrafos.findIndex(
      (texto, indice) => indice > inicio && texto.includes('- Relatórios:')
    );

    assert.ok(inicio >= 0, `${arquivo}: falta o título do escopo técnico`);
    assert.ok(fim > inicio, `${arquivo}: falta o título dos relatórios`);
    assert.deepEqual(
      paragrafos.slice(inicio + 1, fim).filter(texto => texto.trim()),
      [],
      `${arquivo}: ainda guarda serviços fixos no capítulo 7`
    );
  }
});

test('as duas matrizes têm as duas formas de linha', async () => {
  // A matriz tem duas formas: o subtítulo da categoria é uma célula mesclada
  // nas três colunas; o item são três células. Uma modelo só não desenharia as
  // duas, e as categorias sumiriam do documento.
  for (const arquivo of Object.values(ARQUIVOS)) {
    const { xml } = await documentoDe(arquivo);
    const marcadores = marcadoresDe(xml);
    for (const lado of ['filtrovali', 'contratante']) {
      for (const campo of ['categoria', 'escopo', 'nota']) {
        assert.ok(marcadores.has(`${campo}_${lado}`), `${arquivo}: falta ${campo}_${lado}`);
      }
    }
  }
});

test('a coluna Item fica vazia — a numeração é do Word', async () => {
  // Pôr {{n}} ali trocaria a numeração automática por uma nossa, e as duas
  // divergiriam na primeira linha que quebrasse de página.
  const { xml } = await documentoDe(ARQUIVOS.comercial);
  assert.ok(!marcadoresDe(xml).has('n'), 'apareceu numeração manual na matriz');
});

test('só o comercial tem tabela de preços, e o hidro tem DUAS', async () => {
  const padrao = marcadoresDe((await documentoDe(ARQUIVOS.comercial)).xml);
  for (const campo of ['descricao_a', 'unitario_a', 'quantidade_a', 'valor_a', 'total_a']) {
    assert.ok(padrao.has(campo), `falta ${campo} no comercial padrão`);
  }
  assert.ok(!padrao.has('descricao_b'), 'o modelo padrão tem uma tabela só');

  // ONSHORE e OFFSHORE, cada uma com o SEU total — somar as duas mostraria um
  // número que o cliente não vai pagar.
  const hidro = marcadoresDe((await documentoDe(ARQUIVOS.comercialHidro)).xml);
  assert.ok(hidro.has('descricao_b'));
  assert.ok(hidro.has('total_a') && hidro.has('total_b'));

  const tecnica = marcadoresDe((await documentoDe(ARQUIVOS.tecnica)).xml);
  assert.ok(!tecnica.has('descricao_a'), 'a proposta técnica não leva preço');
});

test('o total deixou de ser fórmula do Word', async () => {
  // `=SUM(ABOVE)` não é recalculado pelo LibreOffice na conversão: o PDF sairia
  // com o valor em cache, que é o da proposta de exemplo.
  const { xml } = await documentoDe(ARQUIVOS.comercial);
  assert.ok(!/SUM\(ABOVE\)/.test(xml), 'a fórmula do total sobreviveu');
  assert.ok(marcadoresDe(xml).has('total_a'));
});

test('a tabela de stand-by leva os quatro valores', async () => {
  const marcadores = marcadoresDe((await documentoDe(ARQUIVOS.comercial)).xml);
  for (const campo of ['valor_he', 'valor_standby', 'diaria_equipamento', 'valor_desmob_extra']) {
    assert.ok(marcadores.has(campo), `falta {{${campo}}}`);
  }
});

test('a linha-modelo da matriz clona e some, mesmo sem registro', async () => {
  // A linha-modelo SEMPRE é removida no fim. Deixá-la faria a proposta sair com
  // "{{escopo_filtrovali}}" impresso — e é o caso que ninguém testa, porque em
  // desenvolvimento sempre há dado.
  const { doc } = await documentoDe(ARQUIVOS.comercial);

  const quantas = repetirLinha(doc, '{{escopo_filtrovali}}', [
    { escopo_filtrovali: 'Equipe técnica', nota_filtrovali: '' },
    { escopo_filtrovali: 'Um veículo', nota_filtrovali: 'Nota de débito' }
  ]);
  assert.equal(quantas, 2);

  const restante = new XMLSerializer().serializeToString(doc);
  assert.ok(restante.includes('Equipe técnica'));
  assert.ok(restante.includes('Um veículo'));
  assert.ok(!restante.includes('{{escopo_filtrovali}}'), 'a linha-modelo ficou');
});

test('sem registro nenhum, a linha-modelo some do mesmo jeito', async () => {
  const { doc } = await documentoDe(ARQUIVOS.comercial);
  assert.equal(repetirLinha(doc, '{{escopo_contratante}}', []), 0);
  const restante = new XMLSerializer().serializeToString(doc);
  assert.ok(
    !restante.includes('{{escopo_contratante}}'),
    'a linha-modelo sobreviveu a uma lista vazia'
  );
});

test('o marcador partido entre vários w:t é encontrado', async () => {
  // O Word parte o texto por qualquer motivo, então "{{cliente}}" costuma estar
  // como "{{cli", "en", "te}}". Um replace por nó não acharia nada, e o
  // marcador iria impresso ao cliente.
  const xml =
    '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:r><w:t>{{cli</w:t></w:r><w:r><w:t>en</w:t></w:r><w:r><w:t>te}}</w:t></w:r></w:p>';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  replacePlaceholders(doc.documentElement, { cliente: 'MIP ENGENHARIA' });
  const saida = new XMLSerializer().serializeToString(doc);

  assert.ok(saida.includes('MIP ENGENHARIA'));
  assert.ok(!saida.includes('{{'));
});

test('o modelo preserva TODAS as imagens do documento original', async () => {
  // Isto é regressão de um defeito que eu mesmo criei: ao alinhar a data do
  // cabeçalho, apaguei os runs "vazios" do parágrafo dela — e a arte do
  // timbrado é uma imagem ANCORADA NESSE MESMO PARÁGRAFO. Um run que carrega
  // `w:drawing` não tem texto, então a regra ingênua "apaga o que está vazio"
  // levou o papel timbrado junto. O documento saiu branco e abriu sem reclamar.
  const ORIGINAIS = {
    'Proposta Comercial.docx': 'Proposta Comercial - Preenchida.docx',
    'Proposta técnica.docx': 'Proposta técnica - Preenchida.docx',
    'Proposta comercial hidrojateamento.docx':
      'Proposta comercial hidrojateamento - preenchido.docx',
    'Proposta técnica hidrojateamento.docx': 'Proposta técnica hidrojateamento - Modelo.docx'
  };

  const desenhos = xml =>
    (xml.match(/<w:drawing>/g) || []).length + (xml.match(/<w:pict>/g) || []).length;

  /**
   * Conta as imagens que alguém **vê**.
   *
   * O `.wdp` (JPEG XR) fica de fora: ele não é uma figura do documento, é a
   * representação alternativa que o Word guarda ao lado da imagem normal para
   * certos efeitos. O LibreOffice não o suporta e o descarta ao salvar — e
   * salvar o modelo no LibreOffice é caminho previsto aqui, não acidente.
   * Contá-lo faria o teste reprovar o modelo pelo programa que o salvou.
   */
  const imagensVisiveis = zip =>
    zip
      .getEntries()
      .filter(e => e.entryName.startsWith('word/media/') && !e.entryName.endsWith('.wdp')).length;

  /** Todos os cabeçalhos somados: o modelo pode ter um só ou três. */
  const desenhosNosCabecalhos = zip =>
    zip
      .getEntries()
      .filter(e => /^word\/header\d*\.xml$/.test(e.entryName))
      .reduce((total, e) => total + desenhos(e.getData().toString('utf8')), 0);

  for (const [modelo, original] of Object.entries(ORIGINAIS)) {
    const doOriginal = new AdmZip(await readFile(path.join(ORIGEM, original)));
    const doModelo = new AdmZip(await readFile(path.join(MODELOS, modelo)));

    assert.equal(
      imagensVisiveis(doModelo),
      imagensVisiveis(doOriginal),
      `${modelo}: perdeu arquivo de imagem`
    );

    // O timbrado é somado em TODOS os cabeçalhos, e a comparação é "não pode
    // ser menos", não "tem de ser igual".
    //
    // O defeito que este teste existe para pegar é a arte SUMIR — foi o que
    // aconteceu quando apaguei os runs "vazios" do parágrafo da data. Salvar o
    // modelo no LibreOffice divide um cabeçalho em três e **copia** a arte para
    // o que ele cria, então a conta sobe; exigir igualdade reprovaria o modelo
    // por uma duplicata inofensiva em cabeçalho que a seção nem usa.
    assert.ok(
      desenhosNosCabecalhos(doModelo) >= desenhosNosCabecalhos(doOriginal),
      `${modelo}: perdeu imagem nos cabeçalhos`
    );

    assert.equal(
      desenhos(doModelo.getEntry('word/document.xml').getData().toString('utf8')),
      desenhos(doOriginal.getEntry('word/document.xml').getData().toString('utf8')),
      `${modelo} em word/document.xml: perdeu imagem`
    );
  }
});

test('o documento preenchido não perde imagem no caminho', async () => {
  const { preencherProposta } = await import('../src/lib/comercial/proposta-docx.js');
  const zip = new AdmZip(
    await preencherProposta(
      { modelo: 'padrao', rows: [], prices: [], scopeItems: [] },
      'commercial'
    )
  );
  const arte = zip
    .getEntries()
    .filter(e => /^word\/header\d*\.xml$/.test(e.entryName))
    .some(e => /<w:drawing>/.test(e.getData().toString('utf8')));
  assert.ok(arte, 'o timbrado sumiu no preenchimento');

  // Relativo ao modelo, não a um número fixo: o modelo é editável de propósito,
  // e a garantia aqui é que o PREENCHIMENTO não perde imagem — não que o
  // documento tenha exatamente N figuras.
  const doModelo = new AdmZip(await readFile(path.join(MODELOS, 'Proposta Comercial.docx')));
  const contar = pacote =>
    pacote.getEntries().filter(e => e.entryName.startsWith('word/media/')).length;

  assert.equal(contar(zip), contar(doModelo));
});

/* --------------------------------------------------------------------------
 * Tipografia
 *
 * A fonte da empresa é Arial, mas o padrão do arquivo era o contrário: tema
 * Calibri Light/Calibri e estilo `Default` Calibri 11pt. Cada Arial era uma
 * exceção escrita à mão, e quem não declarava nada caía em Calibri — foi assim
 * que o rodapé e os cabeçalhos das matrizes destoaram.
 * ----------------------------------------------------------------------- */

const parteDe = async (arquivo, nome) => {
  const zip = new AdmZip(await readFile(path.join(MODELOS, arquivo)));
  const entrada = zip.getEntry(nome);
  return entrada ? entrada.getData().toString('utf8') : '';
};

test('nenhuma parte do modelo menciona Calibri ou Times New Roman', async () => {
  // O tema fica de fora porque ele lista fontes de RESERVA POR ESCRITA —
  // Times New Roman para árabe, hebraico e vietnamita. É boilerplate do Office,
  // não se aplica a texto em português, e trocá-las seria mexer no que não
  // incomoda. O que vale ali é o `<a:latin>`, coberto pelo teste seguinte.
  for (const arquivo of Object.values(ARQUIVOS)) {
    for (const parte of [
      'word/document.xml',
      'word/header1.xml',
      'word/footer1.xml',
      'word/styles.xml'
    ]) {
      const xml = await parteDe(arquivo, parte);
      if (!xml) continue;
      const achados = xml.match(/Calibri|Times New Roman/g) || [];
      assert.deepEqual(achados, [], `${arquivo} em ${parte}: sobrou ${achados[0]}`);
    }
  }
});

test('o tema aponta para Arial nas duas famílias', async () => {
  // O tema é a raiz: trocar só os trechos deixaria texto novo nascer em Calibri.
  for (const arquivo of Object.values(ARQUIVOS)) {
    const tema = await parteDe(arquivo, 'word/theme/theme1.xml');
    const maior = /<a:majorFont>[\s\S]*?typeface="([^"]*)"/.exec(tema)?.[1];
    const menor = /<a:minorFont>[\s\S]*?typeface="([^"]*)"/.exec(tema)?.[1];
    assert.equal(maior, 'Arial', `${arquivo}: tema de títulos`);
    assert.equal(menor, 'Arial', `${arquivo}: tema de corpo`);
  }
});

test('o padrão do documento continua declarando uma fonte', async () => {
  // Armadilha que eu criei e desfiz: apagar as referências ao tema deixou o
  // `docDefaults` com `<w:rFonts w:cstheme="minorBidi"/>` e mais nada. Sem
  // `w:ascii` E sem `w:asciiTheme`, cada renderizador cai no padrão DELE —
  // Calibri no Word, Times no LibreOffice — e os dois discordam.
  for (const arquivo of Object.values(ARQUIVOS)) {
    const estilos = await parteDe(arquivo, 'word/styles.xml');
    const padrao = /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/.exec(estilos)?.[0] || '';
    assert.match(padrao, /w:ascii(Theme)?="/, `${arquivo}: docDefaults ficou sem fonte nenhuma`);
  }
});

test('o cabeçalho das tabelas está no tamanho do corpo', async () => {
  // Era 8 e 9pt no meio de uma tabela em 10pt. As DEMAIS linhas ficam como
  // estão de propósito: o modelo de hidrojateamento tem mais de cem trechos em
  // 8pt dentro de células — efetivo e EPI — e subir todos empurraria a
  // paginação sem ninguém ter pedido.
  const { DOMParser: Parser } = await import('@xmldom/xmldom');
  for (const arquivo of Object.values(ARQUIVOS)) {
    const doc = new Parser().parseFromString(
      await parteDe(arquivo, 'word/document.xml'),
      'text/xml'
    );
    for (const tabela of Array.from(doc.getElementsByTagName('w:tbl'))) {
      const primeira = Array.from(tabela.getElementsByTagName('w:tr'))[0];
      if (!primeira) continue;
      for (const sz of Array.from(primeira.getElementsByTagName('w:sz'))) {
        assert.ok(
          Number(sz.getAttribute('w:val')) >= 20,
          `${arquivo}: cabeçalho de tabela em ${Number(sz.getAttribute('w:val')) / 2}pt`
        );
      }
    }
  }
});
