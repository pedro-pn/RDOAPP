import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * A ligação da tela de proposta com a API.
 *
 * O que este arquivo protege é a parte que **erra em silêncio**: o formulário
 * chama o cliente de `client` e a API chama de `clientName`; o consultor é
 * `seller` de um lado e `sellerUserId` do outro. Um par trocado não quebra
 * nada — grava o campo errado, e a proposta sai com o nome no lugar do
 * departamento. Só aparece quando alguém lê o documento emitido.
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
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/salvamento.ts');
});

test.after(async () => {
  await server?.close();
});

function conteudo(extra = {}) {
  return {
    form: {
      client: 'Petrobras',
      cnpj: '33.000.167/0001-01',
      contact: 'Fulano',
      email: 'fulano@cliente.com',
      site: 'Macaé',
      department: 'Manutenção',
      seller: 'u-vend-a',
      title: 'Filtragem de óleo',
      payment: 'À vista',
      ...extra.form
    },
    codigo: '4418',
    orcamentista: 'Orçamentista',
    modelo: 'padrao',
    itensEscopo: [{ id: 's1', title: 'Filtragem', description: 'Circuito A' }],
    blocos: [{ id: 'b1', type: 'table', title: 'Tabela', columns: ['a', 'b'], rows: [] }],
    categorias: ['Infraestrutura', 'Categoria criada na obra'],
    responsabilidades: [{ id: 'r1', item: 'Andaime', owner: 'Contratante', categoria: 'Infra' }],
    precos: [{ description: 'Filtragem', unit: 'dia', quantity: '10', unitValue: '', value: 'R$ 100,00' }],
    incluirUnitario: true,
    servicosTecnicos: [],
    complementoRelatorios: '',
    ...extra
  };
}

// ---------------------------------------------------------------------------
// O mapeamento formulário → API
// ---------------------------------------------------------------------------

test('cada campo do formulário cai no campo certo da API', () => {
  const entrada = mod.entradaDaProposta(conteudo(), 'e1');

  assert.equal(entrada.proposalCode, '4418');
  assert.equal(entrada.clientName, 'Petrobras');
  assert.equal(entrada.cnpj, '33.000.167/0001-01');
  assert.equal(entrada.contact, 'Fulano');
  assert.equal(entrada.email, 'fulano@cliente.com');
  assert.equal(entrada.site, 'Macaé');
  assert.equal(entrada.department, 'Manutenção');
  assert.equal(entrada.sellerUserId, 'u-vend-a');
  assert.equal(entrada.costEstimateId, 'e1');
});

test('o totalValue NÃO é enviado — quem soma é o servidor', () => {
  // Mandá-lo daqui permitiria que o histórico e o CRM dissessem um número que o
  // PDF não confirma.
  const entrada = mod.entradaDaProposta(conteudo(), 'e1');
  assert.ok(!('totalValue' in entrada), 'o total não pode sair do cliente');
});

test('proposta avulsa manda costEstimateId nulo, não string vazia', () => {
  // `''` não é um id: seria uma busca por registro inexistente, que o servidor
  // recusa com 422 — e a proposta sem levantamento é caso normal.
  const entrada = mod.entradaDaProposta(conteudo(), '');
  assert.equal(entrada.costEstimateId, null);
});

test('departamento vazio vira nulo, e o preenchido sobrevive', () => {
  assert.equal(mod.entradaDaProposta(conteudo({ form: { department: '' } }), '').department, null);
  assert.equal(
    mod.entradaDaProposta(conteudo({ form: { department: '  Manutenção  ' } }), '').department,
    'Manutenção'
  );
});

test('espaço em volta do que o usuário digitou não vai para o banco', () => {
  const entrada = mod.entradaDaProposta(
    conteudo({ form: { client: '  Petrobras  ', email: ' fulano@cliente.com ' } }),
    ''
  );

  assert.equal(entrada.clientName, 'Petrobras');
  assert.equal(entrada.email, 'fulano@cliente.com');
});

// ---------------------------------------------------------------------------
// O conteúdo — o mesmo objeto para prévia, salvamento e emissão
// ---------------------------------------------------------------------------

test('o payload leva tudo que o gerador do documento espera', () => {
  const payload = mod.dadosDaProposta(conteudo());

  // Os nomes são os que `proposta-docx.js` procura. Renomear um deles aqui
  // produziria documento com o campo em branco, sem erro nenhum.
  assert.equal(payload.proposalCode, '4418');
  assert.equal(payload.estimator, 'Orçamentista');
  assert.equal(payload.modelo, 'padrao');
  assert.equal(payload.scopeItems.length, 1);
  assert.equal(payload.scopeBlocks.length, 1);
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.prices.length, 1);
  assert.equal(payload.includeUnitValue, true);
  assert.deepEqual(payload.technicalServices, []);
  assert.equal(payload.technicalReports, '');
});

test('o payload preserva os campos livres do formulário', () => {
  const payload = mod.dadosDaProposta(conteudo());

  assert.equal(payload.title, 'Filtragem de óleo');
  assert.equal(payload.payment, 'À vista');
});

test('as categorias vão junto, ainda que o gerador não as use', () => {
  // Sem elas, reabrir a proposta salva traria a matriz sem os subtítulos que o
  // vendedor criou naquela obra.
  const payload = mod.dadosDaProposta(conteudo());
  assert.deepEqual(payload.categorias, ['Infraestrutura', 'Categoria criada na obra']);
});

test('o payload do salvamento é o MESMO da prévia', () => {
  // Montá-lo em dois lugares faria o documento conferido na tela divergir do
  // documento gravado.
  const dados = conteudo();
  assert.deepEqual(mod.entradaDaProposta(dados, '').payload, mod.dadosDaProposta(dados));
});

test('o código do payload é o que foi passado, não o do formulário', () => {
  // No primeiro salvamento o número acabou de ser reservado, e o `codigo` da
  // tela ainda é o "—" que o endereço trazia.
  const payload = mod.dadosDaProposta(conteudo({ codigo: '4500' }));
  assert.equal(payload.proposalCode, '4500');
});

// ---------------------------------------------------------------------------
// A numeração
// ---------------------------------------------------------------------------

test('reconhece quando o número ainda não foi reservado', () => {
  assert.equal(mod.precisaDeNumero('—'), true, 'é o que a tela mostra sem número');
  assert.equal(mod.precisaDeNumero(''), true);
  assert.equal(mod.precisaDeNumero('4418'), false);
});
