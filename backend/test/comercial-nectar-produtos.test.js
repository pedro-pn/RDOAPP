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

test('O CASO QUE IMPORTA: serviço ambíguo RECUSA em vez de escolher', () => {
  // Três serviços têm mais de um candidato no catálogo do Nectar. Escolher por
  // conta própria é decidir no lugar de quem sabe — e o erro só apareceria
  // meses depois, no relatório de vendas por serviço.
  for (const servico of servicosSemProduto()) {
    assert.throws(
      () => produtoDaProposta([{ id: servico }], 1000),
      error => {
        assert.equal(error.statusCode, 422);
        assert.match(error.message, /não foi confirmado pelo comercial/i);
        return true;
      },
      `${servico} deveria recusar`
    );
  }
});

test('as três pendências estão declaradas, não esquecidas', () => {
  // Se um dia alguém mapear uma delas, este teste cai — e é para cair: obriga a
  // ler a lista e confirmar que a decisão veio do comercial.
  assert.deepEqual(servicosSemProduto().sort(), [
    'desidratacao_oleo',
    'filtragem_hidraulico_lubrificante',
    'passagem_pig'
  ]);
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
