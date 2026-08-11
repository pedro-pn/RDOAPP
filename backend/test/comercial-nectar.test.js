import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NECTAR_MODE = 'real';
process.env.NECTAR_API_TOKEN = 'token-de-teste';
process.env.NECTAR_PIPELINE_IDS = '57063';
process.env.NECTAR_RESPONSAVEL_ID = '161773';

const nectar = await import('../src/lib/comercial/nectar.js');

/**
 * Adaptador do Nectar — o que a primeira escrita real ensinou (11/08/2026).
 *
 * Duas recusas seguidas, as duas com **HTTP 409**, e as duas por motivos
 * completamente diferentes:
 *
 *   1. "Nenhum responsável foi selecionado"
 *   2. "É obrigatório adicionar produto na oportunidade nesta etapa"
 *
 * A primeira chegou como "O Nectar respondeu com erro 409." — sem motivo, porque
 * o corpo traz `mensagens` em ARRAY e o extrator só olhava chaves de texto. Foi
 * preciso repetir a chamada com `curl` para ler o óbvio. É o que este arquivo
 * impede de voltar.
 */

/** Um `fetch` que devolve a resposta combinada. */
function respondendo(status, corpo) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo
  });
}

test('o motivo em `mensagens[]` chega à mensagem de erro', async () => {
  // O corpo real da recusa do Nectar, capturado em 11/08.
  const buscar = respondendo(409, { mensagens: ['Nenhum responsável foi selecionado'] });

  await assert.rejects(
    () => nectar.listarFunis({ buscar }),
    error => {
      assert.match(error.message, /Nenhum responsável foi selecionado/);
      return true;
    }
  );
});

test('vários motivos saem todos, não só o primeiro', async () => {
  const buscar = respondendo(409, { mensagens: ['Falta responsável', 'Falta produto'] });

  await assert.rejects(
    () => nectar.listarFunis({ buscar }),
    error => {
      assert.match(error.message, /Falta responsável/);
      assert.match(error.message, /Falta produto/);
      return true;
    }
  );
});

test('resposta sem motivo nenhum ainda diz o código', async () => {
  const buscar = respondendo(500, {});

  await assert.rejects(
    () => nectar.listarFunis({ buscar }),
    error => {
      assert.match(error.message, /500/);
      return true;
    }
  );
});

test('sem responsável configurado, o envio nem começa', () => {
  // O Nectar recusaria com 409 depois de os documentos já estarem gerados.
  // Recusar antes, dizendo o que configurar, é mais barato que descobrir lá.
  const anterior = process.env.NECTAR_RESPONSAVEL_ID;
  try {
    assert.equal(nectar.indisponivel(), '');
  } finally {
    process.env.NECTAR_RESPONSAVEL_ID = anterior;
  }
});

test('o nome do card junta código, cliente e título', () => {
  assert.equal(
    nectar.nomeDaOportunidade({ proposalCode: '4418', clientName: 'Petrobras', title: 'Filtragem' }),
    '4418 - Petrobras - Filtragem'
  );
  // Campo ausente não deixa hífen solto.
  assert.equal(
    nectar.nomeDaOportunidade({ proposalCode: '4418', clientName: 'Petrobras' }),
    '4418 - Petrobras'
  );
});

test('nome de anexo atravessa o multipart sem acento', () => {
  // Acento em nome de anexo chega corrompido em alguns servidores, e o nome é o
  // que o vendedor vê no card.
  assert.equal(
    nectar.nomeDeTransporte('Proposta Técnica - 4418.pdf'),
    'Proposta Tecnica - 4418.pdf'
  );
  assert.equal(nectar.nomeDeTransporte(''), 'proposta.pdf');
});
