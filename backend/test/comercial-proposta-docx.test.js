import assert from 'node:assert/strict';
import test from 'node:test';

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

import {
  arquivoDoModelo,
  preencherProposta
} from '../src/lib/comercial/proposta-docx.js';

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

test('nenhum marcador sobra no documento preenchido', async () => {
  // Marcador que sobra vai IMPRESSO ao cliente, e o `.docx` abre sem reclamar.
  for (const tipo of ['commercial', 'technical']) {
    const { xml } = textoDoDocx(await preencherProposta(DADOS, tipo));
    const sobrou = [...xml.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    assert.deepEqual(sobrou, [], `${tipo}: sobraram marcadores`);
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

  assert.match(texto, /Limpeza química — Circulação pressurizada\./);
  assert.match(texto, /Flushing primário — Regime turbulento\./);
  assert.ok(
    !/visita técnica/i.test(texto),
    'sobrou frase do cardápio que a proposta não escolheu'
  );

  // A ressalva fixa do escopo não é item de lista e tem de sobreviver.
  assert.match(texto, /tubulações embarcadas/);
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
  // As 13 imagens do documento — timbrado, capa e institucionais.
  assert.equal(nomes.filter(n => n.startsWith('word/media/')).length, 13);
});
