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
const MODELOS = path.resolve(AQUI, '../../Modelos/definitivos/Comercial/modelos');

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
  for (const campo of [
    'valor_he',
    'valor_standby',
    'diaria_equipamento',
    'valor_desmob_extra'
  ]) {
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
