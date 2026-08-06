import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { PDFDocument } from 'pdf-lib';

import {
  gerarPropostaComercial,
  gerarPropostaTecnica
} from '../src/lib/comercial/proposal-pdf.js';

/**
 * O gerador dos dois documentos — tarefa T072.
 *
 * **O que dá para verificar sem olhar o papel.** Um PDF errado quase nunca
 * quebra: ele abre, tem páginas, e o defeito é conteúdo faltando ou no lugar
 * errado. Então o teste extrai o texto de volta e pergunta se está lá.
 *
 * O que ele NÃO cobre, e é honesto dizer: posição exata, sobreposição e
 * enquadramento de imagem. Isso é olho no papel.
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
  workday: 'Segunda a quinta: 9h; sexta: 8h.',
  validity: '10',
  includeUnitValue: true,
  modelo: 'padrao',
  payment: 'A título de mobilização, 35% antecipado na confirmação dos serviços.',
  observations: 'Índice de reajuste anual pelo IGPM ou 10%.',
  taxes: 'A Filtrovali se enquadra no regime tributário do lucro presumido.',
  overtimeRate: 'R$ 250,00',
  standbyTeam: 'R$ 11.250,00',
  standbyEquipment: 'R$ 5.000,00',
  extraMobilization: 'R$ 21.900,00',
  scopeItems: [
    { id: 'a', title: 'Limpeza química', description: 'Circulação pressurizada nas linhas.' }
  ],
  scopeBlocks: [],
  rows: [
    {
      categoria: 'MÃO DE OBRA E EQUIPE TÉCNICA',
      owner: 'Filtrovali',
      item: 'Disponibilização de equipe técnica especializada.',
      note: ''
    },
    {
      categoria: 'LOGÍSTICA',
      owner: 'Filtrovali',
      item: 'Um veículo com combustível para translado.',
      note: 'Será apresentado nota de débito'
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
      unit: 'serviço',
      quantity: '1',
      unitValue: 'R$ 38.000,00',
      value: 'R$ 38.000,00'
    }
  ],
  technicalServices: [
    {
      instanceId: 'x',
      serviceId: 'limpeza_quimica',
      title: 'Limpeza química',
      text: 'A limpeza química será planejada e executada com produtos compatíveis.',
      reportCode: 'RLQ',
      parameters: {},
      templateVersion: 1,
      usesTemplate: true
    }
  ],
  technicalReports: '',
  technicalObservations: ''
};

/**
 * Extrai o texto de um PDF via `pdfjs-dist`.
 *
 * Sem isto o teste só conseguiria afirmar que o arquivo existe — e um PDF em
 * branco de dez páginas passaria.
 */
async function textoDoPdf(bytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    .promise;

  const paginas = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const pagina = await doc.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push(conteudo.items.map(item => item.str).join(' '));
  }
  return { paginas, tudo: paginas.join('\n') };
}

test('a proposta comercial sai como PDF com várias páginas', async () => {
  const bytes = await gerarPropostaComercial(DADOS);
  assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');

  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 6, `só ${doc.getPageCount()} páginas`);

  // A4 retrato em todas: uma página em outro tamanho sai com margem errada na
  // impressora sem avisar ninguém.
  for (const pagina of doc.getPages()) {
    const { width, height } = pagina.getSize();
    assert.ok(Math.abs(width - 595.2756) < 0.01);
    assert.ok(Math.abs(height - 841.8898) < 0.01);
  }
});

test('a identificação do cliente sai no documento', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));

  assert.match(tudo, /Proposta Comercial/);
  assert.match(tudo, /MIP ENGENHARIA LTDA\./);
  assert.match(tudo, /Luciano Salazar/);
  assert.match(tudo, /33\.193\.996\/0001-58/);
  assert.match(tudo, /Lucas Silva/);
  assert.match(tudo, /Ruan Casas/);
  // Revisão: "4068 REV. 1", não só "4068".
  assert.match(tudo, /4068 REV\. 1/);
});

test('a data sai por extenso no cabeçalho, e no dia certo', async () => {
  // "2026-01-07" lido como meia-noite UTC seria 6 de janeiro em Brasília.
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));
  assert.match(tudo, /7 de janeiro de 2026/);
  assert.ok(!/6 de janeiro de 2026/.test(tudo), 'a data voltou um dia');
});

test('os treze itens do índice comercial saem, e os dez do técnico', async () => {
  const comercial = await textoDoPdf(await gerarPropostaComercial(DADOS));
  assert.match(comercial.tudo, /Proteção à propriedade intelectual e know-how/);
  assert.match(comercial.tudo, /Aceite e assinatura da proposta/);

  const tecnica = await textoDoPdf(await gerarPropostaTecnica(DADOS));
  assert.match(tecnica.tudo, /Escopo técnico/);
  assert.match(tecnica.tudo, /Relatórios/);
  // O técnico NÃO promete as seções que só existem no comercial.
  assert.ok(!/Aceite e assinatura da proposta/.test(tecnica.tudo));
});

test('a página institucional traz o texto do documento, não o inventado', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));

  assert.match(tudo, /São 21 anos de história/);
  assert.match(tudo, /Tradição, excelência e referência em serviços industriais/);
  assert.match(tudo, /Clientes que confiam e atestam a excelência da Filtrovali/);
  // Os sete serviços do quadro 1.1.
  assert.match(tudo, /Passagem de PIG de espuma/);
  assert.match(tudo, /Centrifugação e desidratação de óleo/);

  // Os números que a prévia inventava um dia.
  assert.ok(!/Desde 2005/.test(tudo));
  assert.ok(!/\+700 projetos/.test(tudo));
});

test('a matriz sai agrupada por categoria, com os dois lados', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));

  assert.match(tudo, /Responsabilidade da Filtrovali/);
  assert.match(tudo, /Responsabilidade da Contratante/);
  // A categoria é o subtítulo que a referência não tinha — desvio 12.
  assert.match(tudo, /MÃO DE OBRA E EQUIPE TÉCNICA/);
  assert.match(tudo, /LOGÍSTICA/);
  assert.match(tudo, /UTILIDADES/);
  assert.match(tudo, /Será apresentado nota de débito/);
});

test('as quatro linhas de prazo saem, inclusive a de integração', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));
  assert.match(tudo, /permanência em obra \(dias corridos\) – 35 dias/);
  assert.match(tudo, /Prazo previsto para integração – 1 dia/);
  assert.match(tudo, /deslocamento não está incluso/);
});

test('a tabela de preços fecha com o total geral somado', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));
  assert.match(tudo, /VALOR UNIT\./);
  assert.match(tudo, /TOTAL GERAL/);
  // "R$ 38.000,00" somado a partir da máscara — Number("R$ 38.000,00") daria NaN.
  assert.match(tudo, /38\.000,00/);
  assert.ok(!/NaN/.test(tudo), 'a máscara de moeda virou NaN em algum lugar');
});

test('o bloco de stand-by sai com a tabela ANTES da explicação', async () => {
  // A explicação diz "conforme a tabela acima". Invertidos, o documento
  // apontaria para o lugar errado.
  const { tudo } = await textoDoPdf(await gerarPropostaComercial(DADOS));

  const posTabela = tudo.indexOf('11.250,00');
  const posExplicacao = tudo.indexOf('Stand-by de Equipe: quando');
  assert.ok(posTabela > 0, 'a tabela de stand-by não saiu');
  assert.ok(posExplicacao > 0, 'a explicação do stand-by não saiu');
  assert.ok(posTabela < posExplicacao, 'a explicação saiu antes da tabela');

  assert.match(tudo, /250,00/); // hora extra
  assert.match(tudo, /21\.900,00/); // mobilização extra
});

test('hidrojateamento sai com DUAS tabelas de preço, uma por local', async () => {
  const hidro = {
    ...DADOS,
    modelo: 'hidrojateamento',
    prices: [
      {
        description: 'Diária de equipamento hidrojato',
        unit: 'diária',
        quantity: '1',
        unitValue: 'R$ 4.500,00',
        value: 'R$ 4.500,00',
        local: 'ONSHORE'
      },
      {
        description: 'Diária de equipamento hidrojato',
        unit: 'diária',
        quantity: '15',
        unitValue: 'R$ 2.900,00',
        value: 'R$ 43.500,00',
        local: 'OFFSHORE'
      }
    ]
  };

  const { tudo } = await textoDoPdf(await gerarPropostaComercial(hidro));
  assert.match(tudo, /ONSHORE/);
  assert.match(tudo, /OFFSHORE/);

  // Cada tabela fecha o SEU total: somar as duas mostraria um número que o
  // cliente não vai pagar, porque são cenários alternativos de execução.
  const totais = tudo.match(/TOTAL GERAL/g) || [];
  assert.equal(totais.length, 2, `saíram ${totais.length} totais gerais`);
  assert.match(tudo, /4\.500,00/);
  assert.match(tudo, /43\.500,00/);
  assert.ok(!/48\.000,00/.test(tudo), 'os dois cenários foram somados num total só');
});

test('a proposta técnica traz o escopo e os relatórios do serviço escolhido', async () => {
  const { tudo } = await textoDoPdf(await gerarPropostaTecnica(DADOS));
  assert.match(tudo, /Proposta Técnica/);
  assert.match(tudo, /7\.1 - Limpeza química/);
  assert.match(tudo, /A limpeza química será planejada/);
  // O texto dos relatórios vem de `buildTechnicalReportsText`, em
  // shared/comercial — é compromisso com o cliente, não texto de tela.
  assert.match(tudo, /RLQ/);
  assert.match(tudo, /RDO/);
});

test('texto longo atravessa a página sem sumir', async () => {
  // Um parágrafo maior que a folha é onde a paginação erra: se a capacidade não
  // for recalculada na folha nova, o resto sai fora do papel — sem erro nenhum.
  const longo = Array.from(
    { length: 120 },
    (_, i) => `Cláusula ${i + 1} de teste com texto suficiente para ocupar uma linha inteira.`
  ).join(' ');

  const { tudo } = await textoDoPdf(
    await gerarPropostaComercial({ ...DADOS, taxes: longo })
  );

  assert.match(tudo, /Cláusula 1 de teste/);
  assert.match(tudo, /Cláusula 120 de teste/, 'o fim do texto longo se perdeu');
});

test('proposta sem escopo, sem preço e sem matriz ainda gera documento', async () => {
  // O documento precisa sair mesmo incompleto: é assim que alguém confere o que
  // falta. Quebrar aqui esconderia o problema em vez de mostrá-lo.
  const vazio = {
    ...DADOS,
    scopeItems: [],
    serviceDescription: '',
    scope: '',
    rows: [],
    prices: [],
    technicalServices: []
  };

  const bytes = await gerarPropostaComercial(vazio);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 5);

  const { tudo } = await textoDoPdf(bytes);
  assert.match(tudo, /Sem itens cadastrados\./);
  assert.match(tudo, /TOTAL GERAL/);
});

test('a folha de identificação não pinta faixa sobre o cabeçalho', async () => {
  // A referência cobria os 48 mm do topo com um retângulo cinza para poder
  // escrever a partir de y=16 — por cima do cabeçalho. No timbrado daqui isso
  // apaga a curva verde e o logotipo e deixa uma faixa que termina no meio da
  // folha. Foi o que apareceu no papel.
  //
  // A prova é a cor sumir do módulo: ela existia SÓ para essa faixa. Farejar o
  // stream de conteúdo do PDF não serviria — o pdf-lib comprime, e a busca por
  // "re ... f" casaria com bytes comprimidos por acaso.
  const primitivas = await import('../src/lib/comercial/pdf-primitivas.js');
  assert.equal(
    primitivas.FUNDO_DA_PAGINA,
    undefined,
    'a cor da faixa voltou ao módulo — provavelmente a faixa também'
  );

  const fonte = await readFile(
    new URL('../src/lib/comercial/proposal-pdf.js', import.meta.url),
    'utf8'
  );
  const bloco = fonte.slice(
    fonte.indexOf('folhaDeIdentificacao()'),
    fonte.indexOf('titulo(valor, y)')
  );
  assert.ok(
    !/preencher\(/.test(bloco),
    'a folha de identificação voltou a preencher retângulo'
  );
});

test('os treze itens do índice cabem na folha', async () => {
  // O índice desceu 37 mm para sair de baixo do cabeçalho. Descer demais faria
  // o último item cair fora do papel — e ele some sem erro nenhum.
  const { paginas } = await textoDoPdf(await gerarPropostaComercial(DADOS));
  const identificacao = paginas[1];

  assert.match(identificacao, /1\.\s+Filtrovali é a escolha certa/);
  assert.match(identificacao, /13\.\s+Aceite e assinatura da proposta/);

  const tecnica = await textoDoPdf(await gerarPropostaTecnica(DADOS));
  assert.match(tecnica.paginas[1], /10\.\s+Observações/);
});
