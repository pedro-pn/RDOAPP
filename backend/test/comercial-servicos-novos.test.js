/**
 * Os dois serviços que o comercial mandou em 13/08 — T133.
 *
 * A fonte é a planilha `Servicos novos - descricao para o comercial.xlsx`, e o
 * que este arquivo trava é **o texto que vai ao cliente**, não a estrutura. Um
 * serviço com o parágrafo errado sai impresso, bonito e assinado.
 *
 * Os outros quatro candidatos da planilha — análise físico-química, sopragem de
 * tubulação, pintura externa e limpeza de gancheiras — foram marcados "não" pelo
 * comercial. O teste registra isso: entrar sozinho é tão defeito quanto não
 * entrar.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TECHNICAL_SERVICE_CATALOG,
  buildTechnicalReportsText,
  createTechnicalServiceSelection,
  technicalReportName,
} from '../../shared/comercial/dist/technical-services.js';
import { PRODUTO_POR_SERVICO } from '../src/lib/comercial/nectar-produtos.js';

function definicao(id) {
  return TECHNICAL_SERVICE_CATALOG.find(servico => servico.id === id);
}

test('flushing com água leva o texto do comercial, palavra por palavra', () => {
  const selecao = createTechnicalServiceSelection('flushing_agua', 'i1');

  assert.equal(selecao.title, 'Flushing com água');
  assert.equal(
    selecao.text,
    'O flushing com água consiste em injetar água em uma tubulação através do método circulação pressurizada com pressão e vazão adequada para atingir o regime turbulento gerando arraste. O objetivo é deixar o sistema adequado para uso removendo os particulados sólidos livres no interior da tubulação.'
  );
});

test('boroscopia leva o texto do comercial, palavra por palavra', () => {
  const selecao = createTechnicalServiceSelection('boroscopia', 'i2');

  assert.equal(selecao.title, 'Boroscopia');
  assert.equal(
    selecao.text,
    'O objetivo principal da Boroscopia industrial é fornecer uma visão interna detalhada de componentes e estruturas industriais para auxiliar na identificação das condições.'
  );
});

test('o flushing com água emite RLF, e a boroscopia não emite relatório nenhum', () => {
  assert.equal(definicao('flushing_agua').reportCode, 'RLF');
  assert.equal(definicao('boroscopia').reportCode, null);
  assert.equal(technicalReportName('RLF'), 'Relatório de Flushing');
});

test('a frase do item 8 é a do comercial, e não a forma padrão das outras', () => {
  const texto = buildTechnicalReportsText([
    createTechnicalServiceSelection('flushing_agua', 'i1'),
  ]);

  // O comercial escreveu "Após a conclusão DO FLUSHING", não "do serviço de
  // flushing com água" como as outras frases fazem. Uniformizar seria trocar o
  // texto de quem responde pelo documento pela minha preferência de frase.
  assert.match(texto, /Após a conclusão do flushing será emitido um RLF \(relatório de flushing\)/);
  assert.match(texto, /imagens do antes e depois de alguns pontos da estrutura caso aplicado\./);
  assert.doesNotMatch(texto, /Após a conclusão do serviço de flushing com água/);
});

test('a boroscopia não acrescenta parágrafo ao item 8', () => {
  const soRdo = buildTechnicalReportsText([
    createTechnicalServiceSelection('boroscopia', 'i2'),
  ]);

  // Só o RDO. Sem segundo parágrafo, a observação sobre a ordem dos relatórios
  // também não entra — ela existe para quando há relatório específico.
  assert.match(soRdo, /^8\.1 — Será entregue diariamente o RDO/);
  assert.doesNotMatch(soRdo, /8\.2/);
  assert.doesNotMatch(soRdo, /relatórios específicos serão elaborados/);
});

test('nenhum dos dois pergunta parâmetro ao vendedor', () => {
  // A planilha deixou a coluna "Pergunta algo?" em branco nos dois. O flushing
  // com água É diferente do primário e do secundário justamente aqui: aqueles
  // circulam o fluido do sistema e cobram classe NAS; este remove particulado
  // com água e não tem critério de NAS para pedir.
  for (const id of ['flushing_agua', 'boroscopia']) {
    const def = definicao(id);
    assert.equal(def.asksNas, undefined, `${id} não deve pedir NAS`);
    assert.equal(def.asksPpm, undefined, `${id} não deve pedir PPM`);
    assert.equal(def.asksMaterial, undefined, `${id} não deve pedir material`);
    assert.equal(def.asksOilType, undefined, `${id} não deve pedir tipo de óleo`);
    assert.deepEqual(createTechnicalServiceSelection(id, 'x').parameters, {});
  }
});

test('os dois têm produto no Nectar — sem mapa, a finalização recusa', () => {
  // O flushing com água tem DOIS produtos ativos no catálogo. Vale o FV-29 por
  // duas fontes que concordam: a regra do mais usado (4 contra 3, medida em
  // 12/08) e a planilha, que o nomeia. O FV-28 "Flushing com água" fica de fora.
  assert.equal(PRODUTO_POR_SERVICO.flushing_agua.id, 3569930);
  assert.equal(PRODUTO_POR_SERVICO.boroscopia.id, 2315558);
});

test('os quatro serviços recusados pelo comercial continuam fora', () => {
  const ids = new Set(TECHNICAL_SERVICE_CATALOG.map(servico => servico.id));
  for (const recusado of [
    'analise_fisico_quimica',
    'sopragem_tubulacao',
    'pintura_externa',
    'limpeza_gancheiras',
  ]) {
    assert.equal(ids.has(recusado), false, `${recusado} foi marcado "não" na planilha`);
  }
});
