/**
 * Item 8: a proposta só promete os relatórios dos serviços contratados.
 *
 * Decidido pelo mantenedor em 13/08. Até então o documento emitido listava
 * **todos** os relatórios, sempre, porque o item 8 é texto fixo do modelo — uma
 * proposta só de limpeza química prometia contagem de partículas, teste de
 * pressão e limpeza de reservatório que ninguém contratou. A prévia da tela já
 * mostrava só os certos, então tela e PDF discordavam, **e quem vai ao cliente
 * é o PDF**.
 *
 * Este arquivo cobre os dois lados com os mesmos casos: a prévia
 * (`buildTechnicalReportsText`) e o `.docx` gerado. Um teste só de um dos lados
 * deixaria voltar exatamente a divergência que a tarefa fechou.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import AdmZip from 'adm-zip';

import {
  RDO_SENTENCE,
  REPORTS_NOTICE,
  buildTechnicalReportsText,
  createTechnicalServiceSelection,
  technicalReportCodesFor,
} from '../../shared/comercial/dist/technical-services.js';
import { preencherProposta } from '../src/lib/comercial/proposta-docx.js';

const selecionar = ids => ids.map((id, i) => createTechnicalServiceSelection(id, `i${i}`));

async function item8DoDocumento(ids, modelo = 'padrao') {
  const buffer = await preencherProposta(
    {
      modelo,
      proposalCode: 'TESTE',
      revision: '0',
      client: 'Cliente',
      contact: 'Contato',
      email: 'c@c.com',
      rows: [],
      prices: [],
      scopeItems: [],
      scopeBlocks: [],
      technicalServices: selecionar(ids),
    },
    'technical'
  );

  return new AdmZip(buffer)
    .getEntry('word/document.xml')
    .getData()
    .toString('utf8')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');
}

const SIGLAS = ['RLQ (', 'RCPU (', 'RTP (', 'RLR (', 'RLF ('];

function siglasPresentes(texto) {
  return SIGLAS.filter(sigla => texto.includes(sigla)).map(s => s.replace(' (', ''));
}

test('o documento promete só o relatório do serviço contratado', async () => {
  const texto = await item8DoDocumento(['limpeza_quimica']);

  assert.deepEqual(siglasPresentes(texto), ['RLQ']);
  // O que mais importa é o que NÃO está lá: era isto que ia impresso.
  assert.ok(!texto.includes('RTP ('), 'não pode prometer teste de pressão');
  assert.ok(!texto.includes('RLR ('), 'não pode prometer limpeza de reservatório');
});

test('dois serviços do mesmo relatório imprimem UM parágrafo, não dois', async () => {
  const texto = await item8DoDocumento(['flushing_primario', 'flushing_secundario']);

  assert.deepEqual(siglasPresentes(texto), ['RCPU']);
  // O `.docx` fala por relatório, não por serviço: "dos serviços de flushing
  // e/ou filtragem absoluta" já cobre os dois. Repetir seria o documento se
  // repetindo palavra por palavra.
  assert.equal(texto.split('RCPU (relatório de contagem').length - 1, 1);
});

test('o RDO aparece sempre, mesmo sem nenhum relatório específico', async () => {
  const texto = await item8DoDocumento(['hidrojateamento'], 'hidrojateamento');

  assert.ok(texto.includes('RDO (relatório diário de obra)'));
  assert.deepEqual(siglasPresentes(texto), []);
});

test('sem relatório específico, a ressalva do "abaixo" também sai', async () => {
  // "os relatórios abaixo só serão elaborados…" sem nada abaixo é frase solta —
  // é o estado em que o modelo de hidrojateamento ficou quando o RH saiu.
  const texto = await item8DoDocumento(['hidrojateamento'], 'hidrojateamento');
  assert.ok(!texto.includes('os relatórios abaixo'));
});

test('havendo relatório específico, a ressalva fica', async () => {
  const texto = await item8DoDocumento(['limpeza_quimica']);
  assert.ok(texto.includes('os relatórios abaixo'));
});

test('os relatórios que não existem não voltam pelo modelo', async () => {
  // RH, RTPP e RIB saíram dos `.docx` em 13/08 por decisão do mantenedor: não
  // são emitidos por ninguém. Se alguém regenerar os modelos a partir de um
  // documento antigo, é aqui que aparece.
  const texto = await item8DoDocumento(['hidrojateamento', 'passagem_pig', 'boroscopia']);

  assert.ok(!texto.includes('RH (relatório de hidrojateamento)'));
  assert.ok(!texto.includes('RTPP'));
  assert.ok(!texto.includes('RIB'));
  assert.ok(!texto.includes('RFA'), 'RFA virou RLF — a sigla antiga não pode sobreviver');
});

test('a prévia da tela mostra exatamente o que o documento mostra', async () => {
  for (const [ids, modelo] of [
    [['limpeza_quimica'], 'padrao'],
    [['flushing_primario', 'flushing_secundario'], 'padrao'],
    [['flushing_agua', 'boroscopia'], 'padrao'],
    [['teste_hidrostatico', 'limpeza_reservatorio'], 'padrao'],
    [['hidrojateamento'], 'hidrojateamento'],
  ]) {
    const previa = buildTechnicalReportsText(selecionar(ids));
    const documento = await item8DoDocumento(ids, modelo);

    assert.deepEqual(
      siglasPresentes(previa),
      siglasPresentes(documento),
      `tela e documento discordam para ${ids.join(' + ')}`
    );
    assert.ok(previa.includes(RDO_SENTENCE), 'a prévia perdeu o RDO');
  }
});

test('a ordem é a do documento, não a da escolha do vendedor', () => {
  const naOrdem = technicalReportCodesFor(selecionar(['teste_hidrostatico', 'limpeza_quimica']));
  const trocada = technicalReportCodesFor(selecionar(['limpeza_quimica', 'teste_hidrostatico']));

  assert.deepEqual(naOrdem, ['RLQ', 'RTP']);
  assert.deepEqual(trocada, naOrdem);
});

test('a ressalva e a frase do RDO são as do .docx, não uma reescrita', () => {
  // Desvio nº 12: onde o texto fixo diverge do documento, o documento vence.
  assert.match(RDO_SENTENCE, /^Será entregue diariamente o RDO \(relatório diário de obra\)/);
  assert.match(REPORTS_NOTICE, /^Obs: Visando a redução de tempo e retrabalho/);
});
