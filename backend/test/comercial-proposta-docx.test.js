import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import {
  arquivoDoModelo,
  preencherProposta
} from '../src/lib/comercial/proposta-docx.js';

const MODELOS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../Modelos/definitivos/Comercial/modelos'
);

/**
 * Quantas imagens o MODELO tem.
 *
 * A contagem era um número fixo no teste (13), e ela caiu para 12 quando alguém
 * abriu o modelo no LibreOffice e salvou: o programa descartou um
 * `hdphoto1.wdp`, que é a representação alternativa que o Word guarda ao lado da
 * imagem normal. Nenhuma figura visível se perdeu.
 *
 * O invariante que interessa não é "o documento tem 13 imagens" — isso é
 * conteúdo do modelo, e o modelo é editável de propósito. É **o preenchimento
 * não perde nem inventa imagem**. Por isso a conta agora é relativa.
 */
function imagensDoModelo(tipo, modelo = 'padrao') {
  const zip = new AdmZip(readFileSync(join(MODELOS, arquivoDoModelo(tipo, modelo))));
  return zip.getEntries().filter(e => e.entryName.startsWith('word/media/')).length;
}

/**
 * O preenchimento do modelo `.docx`.
 *
 * **O que dá para verificar sem abrir o Word.** Um `.docx` mal preenchido abre
 * normalmente: o defeito é marcador impresso, campo em branco ou linha
 * duplicada. Então o teste extrai o texto de volta e pergunta.
 *
 * O que ele NÃO cobre: como a página quebra e como a tabela se ajusta. Isso é o
 * Word decidindo, e só olho no papel resolve.
 */

const DADOS = {
  proposalCode: '4068',
  revision: '1',
  date: '2026-01-07',
  seller: 'Lucas Silva',
  estimator: 'Ruan Casas',
  client: 'MIP ENGENHARIA LTDA.',
  contact: 'Luciano Salazar',
  email: 'luciano.salazar@mip.com.br',
  department: 'Manutenção',
  site: 'CSN CASA DE PEDRA - CONGONHAS/MG',
  cnpj: '33.193.996/0001-58',
  attendance: '15 dias',
  mobilization: '4 dias',
  permanence: '35 dias',
  integration: '1 dia',
  execution: '24 dias',
  validity: '10',
  modelo: 'padrao',
  advancePercent: '35%',
  paymentTerm: '21',
  paymentMethod: 'Depósito em conta',
  overtimeRate: 'R$ 250,00',
  standbyTeam: 'R$ 11.250,00',
  standbyEquipment: 'R$ 5.000,00',
  extraMobilization: 'R$ 21.900,00',
  scopeItems: [
    { id: 'a', title: 'Limpeza química', description: 'Circulação pressurizada.' },
    { id: 'b', title: 'Flushing primário', description: 'Regime turbulento.' }
  ],
  rows: [
    {
      categoria: 'MÃO DE OBRA E EQUIPE TÉCNICA',
      owner: 'Filtrovali',
      item: 'Equipe técnica especializada.',
      note: ''
    },
    {
      categoria: 'LOGÍSTICA',
      owner: 'Filtrovali',
      item: 'Um veículo com combustível.',
      note: 'Nota de débito'
    },
    {
      categoria: 'LOGÍSTICA',
      owner: 'Filtrovali',
      item: 'Hospedagem da equipe.',
      note: 'Nota de débito'
    },
    {
      categoria: 'UTILIDADES',
      owner: 'Contratante',
      item: 'Fornecimento de água limpa.',
      note: ''
    }
  ],
  prices: [
    {
      description: 'Serviço especializado conforme escopo',
      quantity: '1',
      unitValue: 'R$ 38.000,00',
      value: 'R$ 38.000,00'
    },
    {
      description: 'Mobilização e desmobilização',
      quantity: '1',
      unitValue: 'R$ 12.000,00',
      value: 'R$ 12.000,00'
    }
  ]
};

function textoDoDocx(bytes) {
  const zip = new AdmZip(bytes);
  const xml = zip.getEntry('word/document.xml').getData().toString('utf8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const partes = [];
  const nos = doc.getElementsByTagName('w:t');
  for (let i = 0; i < nos.length; i += 1) partes.push(nos[i].textContent || '');
  return { xml, texto: partes.join(' ') };
}

/** Conta as linhas de uma tabela que contém determinado texto. */
function linhasDaTabelaCom(xml, agulha) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tabelas = Array.from(doc.getElementsByTagName('w:tbl'));
  const textoDe = no =>
    Array.from(no.getElementsByTagName('w:t'))
      .map(t => t.textContent || '')
      .join(' ');
  const tabela = tabelas.find(t => textoDe(t).includes(agulha));
  if (!tabela) return 0;
  return Array.from(tabela.getElementsByTagName('w:tr')).length;
}

test('escolhe o modelo pelo tipo e pelo modelo da proposta', () => {
  assert.equal(arquivoDoModelo('commercial', 'padrao'), 'Proposta Comercial.docx');
  assert.equal(
    arquivoDoModelo('commercial', 'hidrojateamento'),
    'Proposta comercial hidrojateamento.docx'
  );
  assert.equal(arquivoDoModelo('technical', 'padrao'), 'Proposta técnica.docx');
  // Modelo desconhecido não pode estourar: cai no padrão.
  assert.equal(arquivoDoModelo('commercial', 'inventado'), 'Proposta Comercial.docx');
});

test('nenhum marcador sobra em NENHUMA parte do pacote', async () => {
  // Marcador que sobra vai IMPRESSO ao cliente, e o `.docx` abre sem reclamar.
  //
  // A primeira versão deste teste olhava só `word/document.xml`, e foi por isso
  // que `{{data_texto}}` — que mora no CABEÇALHO — passou meses sem ser
  // preenchido. Agora varre o pacote inteiro.
  for (const modelo of ['padrao', 'hidrojateamento']) {
    for (const tipo of ['commercial', 'technical']) {
      const zip = new AdmZip(await preencherProposta({ ...DADOS, modelo }, tipo));
      for (const entrada of zip.getEntries()) {
        if (!entrada.entryName.endsWith('.xml')) continue;
        const xml = entrada.getData().toString('utf8');
        const sobrou = [...xml.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
        assert.deepEqual(
          sobrou,
          [],
          `${modelo}/${tipo} em ${entrada.entryName}: sobraram marcadores`
        );
      }
    }
  }
});

/**
 * Os cabeçalhos, TODOS eles.
 *
 * Estes testes olhavam `word/header1.xml` fixo, e quebraram no dia em que
 * alguém abriu o modelo no LibreOffice e salvou: o programa dividiu o cabeçalho
 * em `header1/2/3` e a data foi para o `header2`. Um teste que aponta para uma
 * parte fixa mede o pacote, não o comportamento — e o pacote é editável por
 * quem escreve o documento, de propósito.
 */
function cabecalhos(zip) {
  return zip
    .getEntries()
    .filter(entrada => /^word\/header\d*\.xml$/.test(entrada.entryName))
    .map(entrada => entrada.getData().toString('utf8'));
}

test('a data do cabeçalho sai por extenso, no dia certo', async () => {
  const zip = new AdmZip(await preencherProposta(DADOS, 'commercial'));
  const partes = cabecalhos(zip);

  assert.ok(
    partes.some(xml => /7 de janeiro de 2026/.test(xml)),
    'a data não saiu em nenhum cabeçalho'
  );
  // "2026-01-07" lido como meia-noite UTC seria 6 de janeiro em Brasília.
  assert.ok(
    !partes.some(xml => /6 de janeiro de 2026/.test(xml)),
    'a data voltou um dia'
  );
});

test('a data é alinhada à direita por regra, não por espaços', async () => {
  // No documento entregue ela era empurrada por 109 espaços literais. A largura
  // do espaço difere entre Word e LibreOffice: na conversão a linha estourava a
  // margem, quebrava, e a data reaparecia no começo da linha seguinte.
  const zip = new AdmZip(await preencherProposta(DADOS, 'commercial'));
  const comData = cabecalhos(zip).filter(xml => /de janeiro de 2026/.test(xml));

  assert.ok(comData.length, 'nenhum cabeçalho trouxe a data');
  for (const xml of comData) {
    // `right` e `end` são o MESMO alinhamento: o primeiro é o valor do OOXML
    // transicional, que o Word grava, e o segundo é o do estrito, que o
    // LibreOffice prefere ao salvar. Para texto da esquerda para a direita não
    // há diferença — e exigir só um dos dois faria o teste reprovar o documento
    // pelo programa que o salvou, não pelo que ele contém.
    assert.match(xml, /<w:jc w:val="(right|end)"\/>/);
    assert.ok(
      !/<w:t[^>]*>\s{20,}<\/w:t>/.test(xml),
      'sobrou preenchimento por espaços no cabeçalho'
    );
  }
});

test('todo run criado do zero herda a formatação do parágrafo', async () => {
  // Célula vazia não tinha run nenhum, então o marcador nasceu num run SEM
  // `rPr` — fonte padrão do documento em vez da Arial 10 da tabela. A linha
  // muda de altura e a tabela sai torta no papel, certinha no XML.
  const zip = new AdmZip(await preencherProposta(DADOS, 'commercial'));
  const doc = new DOMParser().parseFromString(
    zip.getEntry('word/document.xml').getData().toString('utf8'),
    'text/xml'
  );

  const textoDe = no =>
    Array.from(no.getElementsByTagName('w:t'))
      .map(t => t.textContent || '')
      .join(' ');

  const linhas = Array.from(doc.getElementsByTagName('w:tr'));
  const daTabela = linhas.filter(tr =>
    textoDe(tr).includes('Serviço especializado conforme escopo')
  );
  assert.ok(daTabela.length, 'a linha de preço não foi encontrada');

  for (const celula of Array.from(daTabela[0].getElementsByTagName('w:tc'))) {
    for (const run of Array.from(celula.getElementsByTagName('w:r'))) {
      if (!textoDe(run).trim()) continue;
      const rPr = Array.from(run.childNodes).find(n => n.nodeName === 'w:rPr');
      assert.ok(rPr, `run sem rPr na célula "${textoDe(celula)}"`);
      assert.match(
        new XMLSerializer().serializeToString(rPr),
        /Arial/,
        'o run não herdou a fonte da tabela'
      );
    }
  }
});

test('a identificação do cliente é preenchida', async () => {
  const { texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));
  assert.match(texto, /Lucas Silva/);
  assert.match(texto, /Ruan Casas/);
  assert.match(texto, /MIP ENGENHARIA LTDA\./);
  assert.match(texto, /Luciano Salazar/);
  assert.match(texto, /33\.193\.996\/0001-58/);
  assert.match(texto, /4068/);
});

test('as quatro linhas de prazo recebem os valores, inclusive a integração', async () => {
  const { texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));
  assert.match(texto, /35\s*dia/);
  assert.match(texto, /1\s*dia/); // integração
  assert.match(texto, /24\s*dia/);
});

test('a matriz sai agrupada, com um subtítulo por categoria', async () => {
  const { xml, texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));

  assert.match(texto, /MÃO DE OBRA E EQUIPE TÉCNICA/);
  assert.match(texto, /LOGÍSTICA/);
  assert.match(texto, /Equipe técnica especializada\./);
  assert.match(texto, /Hospedagem da equipe\./);
  assert.match(texto, /Nota de débito/);

  // LOGÍSTICA tem DUAS obrigações e tem de aparecer UMA vez como subtítulo.
  // É a razão de a categoria ter virado lista suspensa: duas grafias quebrariam
  // o agrupamento e o documento sairia com o subtítulo repetido.
  const ocorrencias = (texto.match(/LOGÍSTICA/g) || []).length;
  assert.equal(ocorrencias, 1, `LOGÍSTICA apareceu ${ocorrencias} vezes`);

  // Cabeçalho + 2 categorias + 3 itens da Filtrovali.
  assert.equal(linhasDaTabelaCom(xml, 'Equipe técnica especializada.'), 6);
});

test('a matriz do contratante é independente da da Filtrovali', async () => {
  const { xml, texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));
  assert.match(texto, /Fornecimento de água limpa\./);
  // Cabeçalho + 1 categoria + 1 item.
  assert.equal(linhasDaTabelaCom(xml, 'Fornecimento de água limpa.'), 3);
});

test('a tabela de preços recebe uma linha por item e o total somado', async () => {
  const { xml, texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));

  assert.match(texto, /Serviço especializado conforme escopo/);
  assert.match(texto, /Mobilização e desmobilização/);
  // 38.000 + 12.000, somados a partir da máscara — Number() daria NaN.
  assert.match(texto, /50\.000,00/);
  assert.ok(!/NaN/.test(texto), 'a máscara de moeda virou NaN');

  // Cabeçalho + 2 itens + total.
  assert.equal(linhasDaTabelaCom(xml, 'Serviço especializado conforme escopo'), 4);
});

test('os itens de escopo substituem o cardápio do documento', async () => {
  // O documento entregue traz dez frases prontas — um cardápio dos serviços que
  // a empresa presta. A proposta usa duas ou três, escolhidas na etapa Escopo.
  const { texto } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));

  assert.match(
    texto,
    /Serviço especializado em mão de obra e execução técnica — Limpeza química — Circulação pressurizada\./
  );
  assert.match(
    texto,
    /Serviço especializado em mão de obra e execução técnica — Flushing primário — Regime turbulento\./
  );
  assert.ok(
    !/visita técnica/i.test(texto),
    'sobrou frase do cardápio que a proposta não escolheu'
  );

  // A ressalva fixa do escopo não é item de lista e tem de sobreviver.
  assert.match(texto, /tubulações embarcadas/);
});

test('o capítulo 3 imprime somente os equipamentos escolhidos na proposta', async () => {
  const dados = {
    ...DADOS,
    rows: [
      ...DADOS.rows,
      {
        categoria: 'EQUIPAMENTOS E FERRAMENTAS',
        owner: 'Filtrovali',
        item: 'Fornecimento de equipamentos necessários à execução, incluindo:',
        note: '',
        subitens: ['1 unidade de flushing primário', 'Equipamento especial do cliente']
      }
    ]
  };
  const { texto } = textoDoDocx(await preencherProposta(dados, 'commercial'));

  assert.match(texto, /1 unidade de flushing primário/);
  assert.match(texto, /Equipamento especial do cliente/);
  assert.ok(
    !texto.includes('1 unidade de limpeza química'),
    'um equipamento não selecionado foi impresso'
  );
});

test('hidrojateamento preenche as DUAS tabelas, cada uma com seu total', async () => {
  const hidro = {
    ...DADOS,
    modelo: 'hidrojateamento',
    prices: [
      {
        description: 'Diária de equipamento hidrojato',
        quantity: '1',
        unitValue: 'R$ 4.500,00',
        value: 'R$ 4.500,00',
        local: 'ONSHORE'
      },
      {
        description: 'Diária de equipamento hidrojato',
        quantity: '15',
        unitValue: 'R$ 2.900,00',
        value: 'R$ 43.500,00',
        local: 'OFFSHORE'
      }
    ]
  };

  const { texto } = textoDoDocx(await preencherProposta(hidro, 'commercial'));
  assert.match(texto, /4\.500,00/);
  assert.match(texto, /43\.500,00/);
  // Cada tabela fecha o SEU total. Somar as duas mostraria R$ 48.000,00 — um
  // número que o cliente não vai pagar, porque são cenários alternativos.
  assert.ok(!/48\.000,00/.test(texto), 'os dois cenários foram somados');
});

test('proposta vazia gera documento sem marcador e sem linha fantasma', async () => {
  // O documento precisa sair mesmo incompleto: é assim que se confere o que
  // falta. E a linha-modelo tem de sumir, senão "{{escopo_filtrovali}}" vai
  // impresso — o caso que ninguém testa, porque em desenvolvimento sempre há dado.
  const vazio = { ...DADOS, rows: [], prices: [], scopeItems: [] };
  const { xml, texto } = textoDoDocx(await preencherProposta(vazio, 'commercial'));

  assert.deepEqual([...xml.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]), []);
  assert.ok(!texto.includes('escopo_filtrovali'));
  assert.ok(!texto.includes('descricao_a'));
});

test('o pacote continua um .docx válido, com as imagens', async () => {
  const zip = new AdmZip(await preencherProposta(DADOS, 'commercial'));
  const nomes = zip.getEntries().map(e => e.entryName);

  assert.ok(nomes.includes('word/document.xml'));
  assert.ok(nomes.includes('[Content_Types].xml'));
  // Sem foto de escopo, o preenchimento não pode perder nem inventar imagem:
  // sai com as mesmas do modelo — timbrado, capa e institucionais.
  assert.equal(
    nomes.filter(n => n.startsWith('word/media/')).length,
    imagensDoModelo('commercial')
  );
});

/* --------------------------------------------------------------------------
 * Blocos do escopo — tabelas e fotos
 *
 * A prévia já desenhava os dois e o documento não: quem montasse a proposta com
 * uma tabela de medições ou uma foto do antes/depois via tudo na tela e recebia
 * um PDF sem nada disso.
 * ----------------------------------------------------------------------- */

/** Um PNG 2x2 de verdade, para o pacote sair com bytes de imagem validos. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+' +
  'FABJADveWkH6oAAAAAElFTkSuQmCC';

const COM_BLOCOS = {
  ...DADOS,
  scopeBlocks: [
    {
      id: 't1',
      type: 'table',
      title: 'Medições previstas',
      columns: ['Sistema', 'Volume'],
      rows: [
        ['Hidráulico', '1200 L'],
        ['Lubrificante', '800 L']
      ]
    },
    {
      id: 'f1',
      type: 'photo',
      assetKey: 'k1',
      src: '',
      fileName: 'antes.png',
      caption: 'Tubulação antes da limpeza',
      aspectRatio: 1.5
    }
  ],
  lerFoto: async () => ({
    bytes: Buffer.from(PNG, 'base64'),
    extensao: 'png',
    mime: 'image/png'
  })
};

test('a tabela do escopo entra no documento com cabeçalho e linhas', async () => {
  const { texto } = textoDoDocx(await preencherProposta(COM_BLOCOS, 'commercial'));
  assert.match(texto, /Medições previstas/);
  assert.match(texto, /Sistema/);
  assert.match(texto, /Hidráulico/);
  assert.match(texto, /1200 L/);
  assert.match(texto, /Lubrificante/);
});

test('a foto do escopo entra como imagem, com legenda', async () => {
  const bytes = await preencherProposta(COM_BLOCOS, 'commercial');
  const zip = new AdmZip(bytes);

  // Os três lugares: bytes, relação e tipo de conteúdo. Esquecer qualquer um
  // produz um pacote que o Word RECUSA a abrir — não um documento feio.
  const midia = zip.getEntries().filter(e => e.entryName.startsWith('word/media/'));
  assert.equal(
    midia.length,
    imagensDoModelo('commercial') + 1,
    'a foto não foi gravada em word/media'
  );

  const rels = zip.getEntry('word/_rels/document.xml.rels').getData().toString('utf8');
  const idDaFoto = /Id="(rId\d+)"[^>]*Target="media\/escopo-/.exec(rels)?.[1];
  assert.ok(idDaFoto, 'a relação da foto não foi criada');

  const tipos = zip.getEntry('[Content_Types].xml').getData().toString('utf8');
  assert.match(tipos, /Extension="png"/, 'faltou o tipo de conteúdo do PNG');

  const documento = zip.getEntry('word/document.xml').getData().toString('utf8');
  assert.ok(
    documento.includes(`r:embed="${idDaFoto}"`),
    'o desenho não referencia a relação criada'
  );

  const { texto } = textoDoDocx(bytes);
  assert.match(texto, /Tubulação antes da limpeza/);
});

test('foto que não carrega não derruba a proposta', async () => {
  // O documento sai sem ela, e quem confere na prévia percebe a falta. Estourar
  // aqui impediria de emitir a proposta inteira por causa de um anexo.
  const semFoto = { ...COM_BLOCOS, lerFoto: async () => { throw new Error('sumiu'); } };
  const { texto } = textoDoDocx(await preencherProposta(semFoto, 'commercial'));
  assert.match(texto, /Medições previstas/, 'a tabela também se perdeu');
  assert.ok(!texto.includes('{{escopo_blocos}}'), 'a âncora ficou impressa');
});

test('sem bloco nenhum, a âncora some do documento', async () => {
  const { texto, xml } = textoDoDocx(await preencherProposta(DADOS, 'commercial'));
  assert.ok(!texto.includes('escopo_blocos'));
  assert.ok(!xml.includes('{{escopo_blocos}}'));
});
