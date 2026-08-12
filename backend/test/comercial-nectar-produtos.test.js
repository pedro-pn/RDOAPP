import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUTO_POR_SERVICO,
  produtoDaProposta,
  servicosSemProduto
} from '../src/lib/comercial/nectar-produtos.js';

/**
 * O produto da oportunidade (T129).
 *
 * A convenção é do comercial, lida dos cards reais em 11/08: **um produto por
 * card**, que é o serviço vendido, `quantidade: 1`, e o valor da proposta nos
 * dois campos de valor.
 *
 * O que este arquivo protege é a recusa: **serviço sem mapa não chuta produto**.
 * Produto errado põe a proposta na categoria errada do CRM, e o relatório de
 * vendas por serviço passa a mentir sem ninguém ver.
 */

test('o produto sai na forma que os cards reais usam', () => {
  const produto = produtoDaProposta([{ id: 'limpeza_quimica' }], 132900);

  assert.deepEqual(produto, {
    refId: 2315553,
    quantidade: 1,
    valorUnitario: 132900,
    valorTotal: 132900
  });
});

test('aceita tanto objeto quanto id solto', () => {
  const comObjeto = produtoDaProposta([{ id: 'flushing_primario' }], 1000);
  const comTexto = produtoDaProposta(['flushing_primario'], 1000);
  assert.deepEqual(comObjeto, comTexto);
});

test('vários serviços: vale o PRIMEIRO, que é o principal da proposta', () => {
  // A regra do comercial é um produto por card. O primeiro é o que dá nome ao
  // documento.
  const produto = produtoDaProposta(
    [{ id: 'teste_hidrostatico' }, { id: 'limpeza_quimica' }],
    5000
  );
  assert.equal(produto.refId, PRODUTO_POR_SERVICO.teste_hidrostatico.id);
});

test('proposta sem serviço técnico recusa, e diz por quê', () => {
  // O funil exige produto: seguir sem ele daria 409 do Nectar depois de os
  // documentos já estarem gerados.
  assert.throws(
    () => produtoDaProposta([], 1000),
    error => {
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /exige produto/i);
      return true;
    }
  );
});

test('todo serviço do módulo tem produto — nenhuma pendência sobrou', () => {
  // As três ambiguidades foram confirmadas pelo comercial em 12/08. Este teste
  // cai de novo se alguém acrescentar serviço ao catálogo sem mapear o produto —
  // e é para cair: proposta com serviço sem produto é recusada pelo funil, e
  // descobrir isso na finalização é tarde.
  assert.deepEqual(servicosSemProduto(), []);
});

test('as duas desidratações apontam para produtos DIFERENTES', () => {
  // É a razão inteira do desvio nº 16: para o comercial são serviços distintos,
  // porque o preço difere. Mapeá-los para o mesmo produto desfaria a separação
  // sem desfazer o desvio — e o relatório de vendas voltaria a juntá-los.
  const lubrificante = produtoDaProposta([{ id: 'desidratacao_oleo' }], 1000);
  const diesel = produtoDaProposta([{ id: 'desidratacao_oleo_diesel' }], 1000);

  assert.equal(lubrificante.refId, 2315550); // FV-02
  assert.equal(diesel.refId, 2320154); // FV-14
  assert.notEqual(lubrificante.refId, diesel.refId);
});

test('a passagem de PIG usa o produto ATIVO, não o homônimo desativado', () => {
  // FV-08 "Passagem de PIG" está `ativo: false` no catálogo; FV-27 é o vivo.
  // Produto inativo não entra em card novo.
  assert.equal(produtoDaProposta([{ id: 'passagem_pig' }], 1000).refId, 2832235);
});

test('serviço sem produto continua RECUSANDO, não chutando', () => {
  // A guarda não pode ter sido removida junto com as pendências: serviço novo
  // sem mapa tem de parar aqui, não virar produto errado no CRM.
  assert.throws(
    () => produtoDaProposta([{ id: 'servico_que_ainda_nao_existe' }], 1000),
    error => error.statusCode === 422
  );
});

test('serviço fora do catálogo do módulo recusa com o nome dele', () => {
  assert.throws(
    () => produtoDaProposta([{ id: 'servico_inventado' }], 1000),
    error => {
      assert.match(error.message, /servico_inventado/);
      return true;
    }
  );
});

test('todo produto mapeado tem id, código e nome', () => {
  for (const [servico, produto] of Object.entries(PRODUTO_POR_SERVICO)) {
    if (!produto) continue;
    assert.ok(Number.isInteger(produto.id), `${servico}: id inválido`);
    assert.match(produto.codigo, /^FV-\d+$/, `${servico}: código fora do padrão`);
    assert.ok(produto.nome, `${servico}: sem nome`);
  }
});
