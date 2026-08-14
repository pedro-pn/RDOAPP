/**
 * A etapa Técnica aponta o campo, não só a frase — T067.
 *
 * A etapa aceita até 11 serviços, cada um com até três parâmetros. Até aqui a
 * validação devolvia só frases ("Flushing primário: informe a classe NAS
 * desejada."), a tela as empilhava num aviso e **nenhum campo acendia**. Com um
 * serviço dá para achar; com onze, o vendedor lê a frase e procura. É o caso que
 * a T067 chama de ponto de travamento mais provável do app: o contador acusa
 * pendência e nada aponta para onde.
 *
 * O que este arquivo trava é o **endereço** — o par cartão + campo —, porque é
 * ele que a tela usa para acender. A lista de frases continua sendo verificada
 * junto, e é derivada da mesma fonte: se as duas se separarem, o contador conta
 * uma coisa e a tela acende outra.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTechnicalServiceSelection,
  updateTechnicalServiceParameter,
  validateTechnicalServiceIssues,
  validateTechnicalServiceSelections
} from '../../shared/comercial/dist/technical-services.js';

const pendencia = (pendencias, campo) => pendencias.find(p => p.field === campo);

/**
 * Um cartão com o parâmetro apagado.
 *
 * Existe porque os modelos **já nascem com valor** nos parâmetros que sabem
 * sugerir — `flushing_primario` vem com `NAS 6`. Um cartão recém-adicionado não
 * está pendente, e é o vendedor apagando o campo que cria a pendência. Escrever
 * o teste sobre o cartão novo testaria o caso que não acontece.
 */
const semParametro = (servico, cartao, campo) =>
  updateTechnicalServiceParameter(createTechnicalServiceSelection(servico, cartao), campo, '');

test('a classe NAS que falta aponta o cartão e o campo', () => {
  const pendencias = validateTechnicalServiceIssues([
    semParametro('flushing_primario', 'cartao-1', 'nasTarget')
  ]);

  const nas = pendencia(pendencias, 'nasTarget');
  assert.ok(nas, 'deveria haver pendência de NAS');
  assert.equal(nas.instanceId, 'cartao-1');
  assert.match(nas.message, /classe NAS/);
});

test('com dois serviços pendentes do mesmo campo, cada um leva o SEU cartão', () => {
  // O caso que a frase sozinha não resolve. As mensagens até se distinguem pelo
  // título do serviço, mas a TELA não sabe casar título com cartão — ela precisa
  // do `instanceId`. Sem ele, acender o campo certo exigiria procurar o cartão
  // pelo texto do rótulo, que é o tipo de ligação que quebra ao renomear.
  const pendencias = validateTechnicalServiceIssues([
    semParametro('flushing_primario', 'cartao-1', 'nasTarget'),
    semParametro('filtragem_oleo_termico', 'cartao-2', 'nasTarget')
  ]);
  const daNas = pendencias.filter(p => p.field === 'nasTarget');

  assert.deepEqual(
    daNas.map(p => p.instanceId),
    ['cartao-1', 'cartao-2'],
    'cada cartão pendente tem o próprio endereço'
  );
});

test('resolver um cartão apaga só a pendência dele', () => {
  const pendente = semParametro('flushing_primario', 'cartao-1', 'nasTarget');
  const resolvido = updateTechnicalServiceParameter(
    createTechnicalServiceSelection('filtragem_oleo_termico', 'cartao-2'),
    'nasTarget',
    'NAS 7'
  );

  const daNas = validateTechnicalServiceIssues([pendente, resolvido]).filter(
    p => p.field === 'nasTarget'
  );

  assert.equal(daNas.length, 1);
  assert.equal(daNas[0].instanceId, 'cartao-1');
});

test('o campo da pendência é a MESMA chave que edita o parâmetro', () => {
  // Sem isso a tela precisaria de uma tabela traduzindo "pendência" → "campo",
  // e essa tabela envelheceria calada no primeiro parâmetro novo.
  const selecao = createTechnicalServiceSelection('limpeza_quimica', 'cartao-1');
  const semMaterial = { ...selecao, parameters: { ...selecao.parameters, material: undefined } };

  const material = pendencia(validateTechnicalServiceIssues([semMaterial]), 'material');
  assert.ok(material);

  const corrigido = updateTechnicalServiceParameter(semMaterial, material.field, 'Aço carbono');
  assert.equal(corrigido.parameters.material, 'Aço carbono');
  assert.equal(pendencia(validateTechnicalServiceIssues([corrigido]), 'material'), undefined);
});

test('"outro metal" só é cobrado depois de o material ser "Outro metal"', () => {
  const base = createTechnicalServiceSelection('limpeza_quimica', 'cartao-1');

  assert.equal(pendencia(validateTechnicalServiceIssues([base]), 'otherMaterial'), undefined);

  const outro = updateTechnicalServiceParameter(base, 'material', 'Outro metal');
  const cobrado = pendencia(validateTechnicalServiceIssues([outro]), 'otherMaterial');
  assert.ok(cobrado, 'escolher "Outro metal" passa a exigir qual é');
  assert.equal(cobrado.instanceId, 'cartao-1');
});

test('pendência da etapa inteira não finge ter campo', () => {
  // "Selecione pelo menos um serviço" não tem onde acender: não há cartão.
  // Devolver um campo qualquer faria a tela procurar um input que não existe.
  const [vazia] = validateTechnicalServiceIssues([]);

  assert.equal(vazia.instanceId, '');
  assert.equal(vazia.field, '');
  assert.match(vazia.message, /pelo menos um serviço/);
});

test('as frases do contador são exatamente as das pendências', () => {
  // As duas leituras saem da mesma fonte. Escritas à mão, divergiriam no
  // primeiro parâmetro novo — e a tela acenderia um campo que ninguém conta.
  const selecoes = [
    semParametro('flushing_primario', 'a', 'nasTarget'),
    semParametro('desidratacao_oleo', 'b', 'ppmTarget'),
    createTechnicalServiceSelection('limpeza_quimica', 'c')
  ];

  assert.ok(validateTechnicalServiceIssues(selecoes).length >= 2, 'o caso precisa ter pendência');
  assert.deepEqual(
    validateTechnicalServiceSelections(selecoes),
    validateTechnicalServiceIssues(selecoes).map(p => p.message)
  );
});

test('serviço sem parâmetro pendente não gera endereço nenhum', () => {
  const selecoes = [
    createTechnicalServiceSelection('hidrojateamento', 'a'),
    createTechnicalServiceSelection('boroscopia', 'b'),
    createTechnicalServiceSelection('flushing_agua', 'c')
  ];

  assert.deepEqual(validateTechnicalServiceIssues(selecoes), []);
});
