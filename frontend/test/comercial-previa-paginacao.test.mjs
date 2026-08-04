import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * Onde o documento quebra de página (tarefa T065).
 *
 * **Isto não é apresentação, é regra.** Uma tabela de 40 linhas não cabe numa
 * folha A4: alguém decide onde ela parte, e a decisão tem de ser a mesma na
 * prévia e no PDF. Se divergirem, a prévia deixa de servir para o que existe —
 * conferir o documento antes de emitir.
 *
 * Por isso a paginação mora num módulo puro, e por isso ela tem teste: é o tipo
 * de conta que erra em silêncio e só aparece no papel.
 */

let server;
let mod;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/previaPaginacao.ts');
});

test.after(async () => {
  await server?.close();
});

test('quebra o texto respeitando as palavras', () => {
  assert.deepEqual(mod.quebrarTexto('um dois tres quatro', 9), ['um dois', 'tres', 'quatro']);
  assert.deepEqual(mod.quebrarTexto('linha um\nlinha dois', 40), ['linha um', 'linha dois']);
});

test('palavra maior que a linha é FATIADA, não deixada estourando', () => {
  // Um código de peça de 90 caracteres numa coluna estreita arrebentaria a
  // largura da tabela no PDF, e ali não há barra de rolagem para salvar.
  const linhas = mod.quebrarTexto('ABCDEFGHIJKLMNOPQRST', 5);
  assert.deepEqual(linhas, ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']);
  for (const linha of linhas) assert.ok(linha.length <= 5);
});

test('texto vazio vira travessão, não linha em branco', () => {
  assert.deepEqual(mod.quebrarTexto('', 20), ['—']);
  assert.deepEqual(mod.quebrarTexto(null, 20), ['—']);
});

test('tabela curta cabe numa folha só', () => {
  const linhas = [
    ['1', 'Desengraxe'],
    ['2', 'Enxágue']
  ];
  assert.equal(mod.paginarLinhasDaTabela(linhas, 2).length, 1);
});

test('tabela longa parte em folhas, sem perder nem duplicar linha', () => {
  // 40 linhas é o limite por tabela do editor — o pior caso real.
  const linhas = Array.from({ length: 40 }, (_, i) => [String(i + 1), `Etapa ${i + 1}`]);
  const paginas = mod.paginarLinhasDaTabela(linhas, 2);

  assert.ok(paginas.length > 1, 'quarenta linhas não cabem numa folha');

  const total = paginas.reduce((soma, p) => soma + p.length, 0);
  assert.equal(total, 40, 'nenhuma linha some nem se repete');
});

test('cada folha respeita o orçamento de linhas', () => {
  const linhas = Array.from({ length: 30 }, (_, i) => [String(i), 'texto curto']);
  for (const pagina of mod.paginarLinhasDaTabela(linhas, 2)) {
    assert.ok(
      pagina.length <= mod.ORCAMENTO_DE_LINHAS,
      `folha com ${pagina.length} linhas passa do orçamento`
    );
  }
});

test('linha alta demais para uma folha vazia é partida, não empurrada para sempre', () => {
  // Sem isto o algoritmo entra em laço: a linha nunca cabe, nunca avança.
  const paragrafo = 'palavra '.repeat(400).trim();
  const paginas = mod.paginarLinhasDaTabela([['1', paragrafo]], 2);

  assert.ok(paginas.length >= 1);
  assert.ok(paginas.every(p => p.length > 0));
});

test('tabela sem linha nenhuma ainda produz uma folha', () => {
  // O cabeçalho precisa aparecer: uma tabela declarada e ausente do documento
  // é pior que uma tabela vazia — some sem deixar rastro.
  const paginas = mod.paginarLinhasDaTabela([], 3);
  assert.equal(paginas.length, 1);
  assert.equal(paginas[0][0].length, 3);
});

test('a numeração de tabelas e figuras é CONTÍNUA na proposta', () => {
  // Quem procura a "Figura 3" não quer saber de qual serviço ela é.
  const blocos = [
    { id: 'a', type: 'table', scopeItemId: 's1', title: 'Uma', columns: ['A', 'B'], rows: [['1', '2']] },
    { id: 'b', type: 'photo', scopeItemId: 's1', src: 'x', fileName: 'f.jpg', caption: '', assetKey: 'k', aspectRatio: 1 },
    { id: 'c', type: 'table', scopeItemId: 's2', title: 'Duas', columns: ['A', 'B'], rows: [['3', '4']] },
    { id: 'd', type: 'photo', scopeItemId: 's2', src: 'y', fileName: 'g.jpg', caption: '', assetKey: 'k2', aspectRatio: 1 }
  ];

  const rotulos = mod.paginasDoEscopo(blocos).map(p => p.rotulo);
  assert.deepEqual(rotulos, ['Tabela 1 — Uma', 'Figura 1', 'Tabela 2 — Duas', 'Figura 2']);
});

test('tabela que ocupa duas folhas mantém UM número e ganha "parte"', () => {
  const blocos = [
    {
      id: 'grande',
      type: 'table',
      scopeItemId: 's1',
      title: 'Etapas',
      columns: ['A', 'B'],
      rows: Array.from({ length: 40 }, (_, i) => [String(i), 'texto'])
    }
  ];

  const paginas = mod.paginasDoEscopo(blocos);
  assert.ok(paginas.length > 1);
  for (const pagina of paginas) {
    assert.equal(pagina.rotulo, 'Tabela 1 — Etapas', 'a numeração é da TABELA, não da folha');
    assert.equal(pagina.totalDePartes, paginas.length);
  }
  assert.deepEqual(
    paginas.map(p => p.parte),
    paginas.map((_, i) => i + 1)
  );
});

test('o título da folha amarra ela ao serviço de onde veio', () => {
  const itens = [
    { id: 's1', title: 'Flushing', description: '' },
    { id: 's2', title: '', description: '' }
  ];

  assert.equal(mod.tituloDoItemDeEscopo(itens, 's1'), '2.1 Flushing');
  assert.equal(mod.tituloDoItemDeEscopo(itens, 's2'), '2.2 Serviço 2');
  // Bloco órfão cai no primeiro serviço em vez de sumir do documento.
  assert.equal(mod.tituloDoItemDeEscopo(itens, 'nao-existe'), '2.1 Flushing');
  assert.equal(mod.tituloDoItemDeEscopo([], 's1'), '2.1 Conteúdo complementar do escopo');
});

test('sem serviço técnico selecionado não há folha técnica', () => {
  assert.deepEqual(mod.paginasTecnicas([], ''), []);
});

test('cada serviço técnico vira folha, e os relatórios vêm no fim', () => {
  const selecoes = [
    { instanceId: 'i1', serviceId: 'flushing', title: 'Flushing', text: 'texto curto', templateVersion: 1, usesTemplate: true, parameters: {}, reportCode: 'RLQ' }
  ];

  const paginas = mod.paginasTecnicas(selecoes, '');
  assert.ok(paginas.length >= 2, 'o serviço e os relatórios');
  assert.match(paginas[0].titulo, /^7\.1 — Flushing/);
  assert.match(paginas[paginas.length - 1].titulo, /^8\. Relatórios/);
});
