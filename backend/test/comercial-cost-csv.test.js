import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  linhasDaPlanilha,
  nomeDaPlanilha,
  planilhaDeCustos
} from '../src/lib/comercial/cost-csv.js';

/**
 * A planilha de custos anexada à finalização (T076a e T076b).
 *
 * **O formato é contrato, não preferência**, e é o que este arquivo protege: o
 * comercial abre isto no Excel em português, e cada uma das quatro regras
 * abaixo, quebrada sozinha, produz uma planilha que ABRE e está ilegível ou
 * errada — que é a pior forma de defeito.
 */

const here = dirname(fileURLToPath(import.meta.url));
const goldensDir = join(here, '../../specs/009-modulo-comercial/contracts/goldens');

function carregarGolden(nome) {
  return JSON.parse(readFileSync(join(goldensDir, `${nome}.golden.json`), 'utf8'));
}

function levantamento(payload, extra = {}) {
  return {
    id: 'e1',
    proposalCode: '4418',
    title: 'Filtragem de óleo — Macaé',
    payload,
    totalCost: 100000,
    salePrice: 130000,
    marginPercent: 15,
    ...extra
  };
}

const CONTEXTO = {
  proposalCode: '4418',
  sellerName: 'Vendedor A',
  estimatorName: 'Orçamentista',
  pipelineName: 'Gestão Comercial'
};

/** Desfaz o CSV de volta em matriz, para o teste perguntar por célula. */
function lerCsv(bytes) {
  const texto = bytes.toString('utf8').replace(/^﻿/, '');
  return texto.split('\r\n').map(linha =>
    linha === ''
      ? []
      : linha
          .slice(1, -1)
          .split('";"')
          .map(celula => celula.replace(/""/g, '"'))
  );
}

// ---------------------------------------------------------------------------
// O formato do arquivo
// ---------------------------------------------------------------------------

test('o arquivo começa com BOM — sem ele o Excel quebra todo acento', () => {
  // Sem o BOM o Excel em português lê como Latin-1, e "MOBILIZAÇÃO" chega
  // "MOBILIZAÃ‡ÃƒO". O arquivo abre normalmente e está ilegível.
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const { bytes } = planilhaDeCustos(levantamento(golden.payload), CONTEXTO);

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test('o separador é ponto e vírgula, não vírgula', () => {
  // No Brasil a vírgula é decimal, e o Excel em pt-BR espera `;`. Com vírgula,
  // cada valor monetário partiria a linha em duas colunas.
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const { bytes } = planilhaDeCustos(levantamento(golden.payload), CONTEXTO);
  // O BOM precede a primeira linha — tirar aqui é o que a leitura do Excel faz.
  const primeira = bytes.toString('utf8').replace(/^﻿/, '').split('\r\n')[0];

  assert.match(primeira, /^"LEVANTAMENTO DE CUSTOS";"/);
  assert.ok(!primeira.includes('","'), 'a vírgula partiria o valor monetário em duas colunas');
});

test('as linhas terminam em CRLF', () => {
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const { bytes } = planilhaDeCustos(levantamento(golden.payload), CONTEXTO);
  const texto = bytes.toString('utf8');

  assert.ok(texto.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(texto), 'sobrou quebra de linha sem CR');
});

test('aspas dentro da célula são duplicadas, e o ponto e vírgula não parte a coluna', () => {
  // Uma descrição com `;` ou com aspas destruiria o alinhamento de todas as
  // colunas seguintes — e o comercial só descobre lendo número no lugar errado.
  const { bytes } = planilhaDeCustos(
    levantamento({ schemaVersion: 1, lines: [{ role: 'Operador "A"; noturno', quantity: 2 }] }),
    CONTEXTO
  );
  const texto = bytes.toString('utf8');

  assert.ok(texto.includes('"Operador ""A""; noturno"'));
});

test('o nome do arquivo é o do contrato', () => {
  assert.equal(nomeDaPlanilha('4418'), 'Levantamento de Custos - 4418.csv');

  const { fileName } = planilhaDeCustos(levantamento({}), CONTEXTO);
  assert.equal(fileName, 'Levantamento de Custos - 4418.csv');
});

test('sem código, o nome não sai quebrado', () => {
  const { fileName } = planilhaDeCustos(levantamento({}, { proposalCode: '' }), {});
  assert.equal(fileName, 'Levantamento de Custos - sem-numero.csv');
});

// ---------------------------------------------------------------------------
// O cabeçalho
// ---------------------------------------------------------------------------

test('o cabeçalho identifica proposta, vendedor, orçamentista e funil', () => {
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const linhas = lerCsv(planilhaDeCustos(levantamento(golden.payload), CONTEXTO).bytes);
  const valorDe = rotulo => linhas.find(l => l[0] === rotulo)?.[1];

  assert.equal(valorDe('LEVANTAMENTO DE CUSTOS'), 'Filtragem de óleo — Macaé');
  assert.equal(valorDe('PROPOSTA'), '4418');
  assert.equal(valorDe('CONSULTOR DE VENDAS'), 'Vendedor A');
  assert.equal(valorDe('ORÇAMENTISTA'), 'Orçamentista');
  assert.equal(valorDe('FUNIL NECTAR'), 'Gestão Comercial');
});

test('sem nome de funil, o cabeçalho cai no id em vez de ficar vazio', () => {
  const linhas = lerCsv(
    planilhaDeCustos(levantamento({}), { ...CONTEXTO, pipelineName: '', pipelineId: '100' }).bytes
  );
  assert.equal(linhas.find(l => l[0] === 'FUNIL NECTAR')?.[1], '100');
});

// ---------------------------------------------------------------------------
// Os dois formatos (FR-055)
// ---------------------------------------------------------------------------

test('esquema 2 traz mão de obra POR FASE', () => {
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const linhas = linhasDaPlanilha(levantamento(golden.payload), CONTEXTO);
  const titulos = linhas.map(l => l[0]);

  assert.ok(titulos.includes('MÃO DE OBRA POR FASE / CONTEXTO'));
  assert.ok(titulos.includes('MOBILIZAÇÃO E DESMOBILIZAÇÃO'));
  assert.ok(titulos.includes('FORMAÇÃO DE PREÇO'));
  assert.ok(!titulos.includes('TOTAL DE COLABORADORES'), 'saiu no formato legado');
});

test('payload legado NÃO quebra a finalização — sai no formato antigo', () => {
  // FR-055. Quem revisa um levantamento de dois anos atrás precisa da planilha
  // do jeito que aquele levantamento foi feito, não de colunas vazias.
  const linhas = linhasDaPlanilha(
    levantamento({
      schemaVersion: 1,
      lines: [{ role: 'Operador', quantity: 2, months: 3, salary: 4000 }]
    }),
    CONTEXTO
  );
  const titulos = linhas.map(l => l[0]);

  assert.ok(titulos.includes('FUNÇÃO'), 'o formato legado tem a tabela função × meses');
  assert.ok(titulos.includes('TOTAL DE COLABORADORES'));
  assert.ok(!titulos.includes('MÃO DE OBRA POR FASE / CONTEXTO'));
  assert.deepEqual(linhas.find(l => l[0] === 'Operador'), ['Operador', 2, 3, 4000, 0]);
});

test('payload sem schemaVersion mas COM laborContexts usa o esquema 2', () => {
  // Houve payload gravado sem a versão e já com a estrutura nova. Decidir só
  // pelo número mandaria esse levantamento para o formato legado, e ele sairia
  // com a tabela de mão de obra vazia.
  const linhas = linhasDaPlanilha(
    levantamento({ laborContexts: [{ id: 'c1', name: 'Fase 1', assignments: [] }] }),
    CONTEXTO
  );

  assert.ok(linhas.map(l => l[0]).includes('MÃO DE OBRA POR FASE / CONTEXTO'));
});

test('levantamento vazio gera planilha, não exceção', () => {
  // A finalização não pode cair porque o levantamento está incompleto.
  const { bytes } = planilhaDeCustos(levantamento({}), CONTEXTO);
  assert.ok(bytes.length > 0);
});

// ---------------------------------------------------------------------------
// Os números são os do MOTOR, não os do payload
// ---------------------------------------------------------------------------

test('a formação de preço bate com o golden — é o mesmo motor do valor gravado', () => {
  // A referência lia `payload.result`, gravado pelo cliente. Aqui o servidor
  // recalcula com `calculateEstimate`, então a planilha não pode discordar do
  // valor que foi para a proposta e para o CRM.
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const linhas = linhasDaPlanilha(levantamento(golden.payload), CONTEXTO);
  const valorDe = rotulo => linhas.find(l => l[0] === rotulo)?.[1];

  assert.equal(Number(valorDe('VALOR FINAL DA PROPOSTA')), Number(golden.result.salePrice));
  assert.equal(Number(valorDe('MARGEM')), Number(golden.result.margin));
});

test('a margem sai como fração, no mesmo formato do motor', () => {
  // A coluna do banco guarda percentual e o motor devolve fração. Misturar as
  // duas na mesma planilha daria a mesma margem escrita de dois jeitos.
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const linhas = linhasDaPlanilha(levantamento(golden.payload), CONTEXTO);
  const margem = Number(linhas.find(l => l[0] === 'MARGEM')?.[1]);

  assert.ok(margem < 1, 'a margem saiu em percentual, não em fração');
});

test('as seções do esquema 2 saem todas, na ordem da referência', () => {
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const titulos = linhasDaPlanilha(levantamento(golden.payload), CONTEXTO)
    .map(l => l[0])
    .filter(t => typeof t === 'string');

  const esperadas = [
    'MÃO DE OBRA POR FASE / CONTEXTO',
    'DESPESAS INDIRETAS',
    'MATERIAIS E INSUMOS',
    'TUBULAÇÕES E VOLUMES',
    'PRODUTOS / CONSUMÍVEIS CALCULADOS',
    'FILTROS',
    'PREVISÃO DE EFLUENTE',
    'MOBILIZAÇÃO E DESMOBILIZAÇÃO',
    'FORMAÇÃO DE PREÇO'
  ];

  let anterior = -1;
  for (const secao of esperadas) {
    const posicao = titulos.indexOf(secao);
    assert.ok(posicao >= 0, `a seção ${secao} sumiu da planilha`);
    assert.ok(posicao > anterior, `a seção ${secao} saiu fora de ordem`);
    anterior = posicao;
  }
});

test('a tabela de logística tem as 49 colunas do cabeçalho', () => {
  // A seção é a mais larga e a mais condicional: cada modo preenche um
  // subconjunto. Linha com contagem diferente do cabeçalho desalinha tudo.
  const linhas = linhasDaPlanilha(
    levantamento({
      schemaVersion: 2,
      laborContexts: [],
      logistics: [
        { id: 'l1', direction: 'Mobilização', calculationMode: 'company_crew_vehicle', description: 'Ida' },
        { id: 'l2', direction: 'Desmobilização', calculationMode: 'air_crew_transport', description: 'Volta' }
      ]
    }),
    CONTEXTO
  );

  const inicio = linhas.findIndex(l => l[0] === 'MOBILIZAÇÃO E DESMOBILIZAÇÃO');
  const cabecalho = linhas[inicio + 1];
  assert.equal(cabecalho.length, 49);
  assert.equal(linhas[inicio + 2].length, cabecalho.length);
  assert.equal(linhas[inicio + 3].length, cabecalho.length);
});

test('coluna que não se aplica ao modo fica em BRANCO, não em zero', () => {
  // Zero num item que não usa veículo diria "rodou 0 km". Branco diz "não se
  // aplica" — e a diferença muda a leitura de quem confere.
  const linhas = linhasDaPlanilha(
    levantamento({
      schemaVersion: 2,
      laborContexts: [],
      logistics: [
        { id: 'l1', direction: 'Mobilização', calculationMode: 'air_crew_transport', description: 'Aéreo' }
      ]
    }),
    CONTEXTO
  );

  const inicio = linhas.findIndex(l => l[0] === 'MOBILIZAÇÃO E DESMOBILIZAÇÃO');
  const cabecalho = linhas[inicio + 1];
  const linha = linhas[inicio + 2];

  // Transporte aéreo não tem combustível nem pedágio.
  assert.equal(linha[cabecalho.indexOf('COMBUSTÍVEL (L)')], '');
  assert.equal(linha[cabecalho.indexOf('PEDÁGIO')], '');
  // Mas tem passagem.
  assert.equal(cabecalho.indexOf('CUSTO DAS PASSAGENS') >= 0, true);
});

test('a planilha do golden 02 sai inteira, sem célula indefinida', () => {
  const golden = carregarGolden('02-sede-sem-hora-extra');
  const { bytes } = planilhaDeCustos(levantamento(golden.payload), CONTEXTO);
  const texto = bytes.toString('utf8');

  assert.ok(!texto.includes('undefined'), 'sobrou "undefined" impresso na planilha');
  assert.ok(!texto.includes('NaN'), 'sobrou "NaN" impresso na planilha');
  assert.ok(!texto.includes('[object Object]'), 'sobrou objeto impresso na planilha');
});

test('a memória de cálculo registra jornada individual, HE variável e sem veículo', () => {
  const payload = structuredClone(carregarGolden('02-sede-sem-hora-extra').payload);
  const contexto = payload.laborContexts[0];
  const alocacao = contexto.assignments[0];
  contexto.vehicleType = 'none';
  contexto.workCondition = 'travel';
  contexto.hotelSiteDistanceKmPerDay = 0;
  contexto.expenses = [];
  alocacao.workSchedule = {
    name: 'Plantão de Maria',
    targetType: 'collaborator',
    collaboratorName: 'Maria',
    days: [{
      dayType: 'saturday', days: 1, normalHoursPerDay: 8,
      extraHoursPerDay: 2, overtimePercent: 50
    }]
  };

  const linhas = linhasDaPlanilha(levantamento(payload), CONTEXTO);
  const inicio = linhas.findIndex(l => l[0] === 'MÃO DE OBRA POR FASE / CONTEXTO');
  const cabecalho = linhas[inicio + 1];
  const linha = linhas[inicio + 2];
  const linhaVeiculo = linhas.find(l => String(l[1] || '').includes('VEÍCULO:'));

  assert.equal(linha.length, cabecalho.length);
  assert.equal(linha[cabecalho.indexOf('CENÁRIO DE JORNADA')], 'Plantão de Maria');
  assert.equal(linha[cabecalho.indexOf('ALVO DA JORNADA')], 'COLABORADOR');
  assert.equal(linha[cabecalho.indexOf('COLABORADOR')], 'Maria');
  assert.equal(Number(linha[cabecalho.indexOf('HH EXTRA COM PERCENTUAL CONFIGURADO')]), 2);
  assert.ok(Number(linha[cabecalho.indexOf('CUSTO EXTRA COM PERCENTUAL CONFIGURADO')]) > 0);
  assert.equal(linhaVeiculo.length, cabecalho.length);
  assert.match(linhaVeiculo[1], /SEM VEÍCULO/);
  assert.match(linhaVeiculo[11], /NÃO APLICÁVEL/);
});
