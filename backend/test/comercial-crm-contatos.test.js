import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NECTAR_MODE = 'real';
process.env.NECTAR_API_TOKEN = 'token-de-teste';

const {
  buscarEmpresas,
  comoEmpresa,
  empresaComContatos,
  filtrarPorTrecho,
  limparIndice,
  normalizar
} = await import('../src/lib/comercial/crm-contatos.js');

/**
 * Busca de empresa no CRM (T121 e T123).
 *
 * As respostas imitam a forma real do Nectar, medida em 12/08. O que precisa ser
 * provado é o que a API **não** faz:
 *
 * - o filtro `nome` casa só por PREFIXO — "petrobras" devolve zero, e é a queixa
 *   do comercial;
 * - a paginação leva **429** quando varrida sem pausa.
 *
 * O índice local existe por causa dos dois, e é ele que este arquivo protege.
 */

const PETROBRAS = {
  id: 51577031,
  nome: 'PETROLEO BRASILEIRO S A PETROBRAS',
  cnpj: '33000167064347',
  isEmpresa: true,
  enderecos: [{ principal: true, logradouro: 'Av. República do Chile', numero: '65', municipio: 'Rio de Janeiro', estado: 'RJ' }],
  contatos: [{ id: 1, nome: 'Gabriela Antunes', emails: ['gabriela@petrobras.com'], cargo: 'Manutenção' }]
};

const PETRORECONCAVO = { id: 49498259, nome: 'PETRORECONCAVO S/A', cnpj: '03342704000483', isEmpresa: true };
const SEM_CNPJ = { id: 777, nome: 'PETROQUÍMICA NOVA LTDA', isEmpresa: true };
const PESSOA = { id: 888, nome: 'Petronilo da Silva', isEmpresa: false };

/**
 * Um Nectar de mentira que **repete o comportamento real**: o filtro `nome` casa
 * por prefixo, e a paginação devolve 100 por vez.
 */
function nectarFalso({ paginas = [[PETROBRAS, PETRORECONCAVO, SEM_CNPJ, PESSOA]] } = {}) {
  const chamadas = [];

  const buscar = async url => {
    const endereco = new URL(String(url));
    chamadas.push(endereco.pathname + endereco.search);

    const nome = endereco.searchParams.get('nome');
    if (nome) {
      const alvo = normalizar(nome);
      const todos = paginas.flat();
      // PREFIXO, como o Nectar de verdade.
      return resposta(todos.filter(c => normalizar(c.nome).startsWith(alvo)));
    }

    const pagina = Number(endereco.searchParams.get('page') || 1);
    return resposta(paginas[pagina - 1] ?? []);
  };

  return { buscar, chamadas, dormir: async () => {} };
}

const resposta = corpo => ({ ok: true, status: 200, json: async () => corpo });

test.beforeEach(() => limparIndice());

// ---------------------------------------------------------------------------
// Empresa é contato com isEmpresa
// ---------------------------------------------------------------------------

test('empresa é contato com isEmpresa, não contato com CNPJ', async () => {
  // A referência filtrava por CNPJ de 14 dígitos. Medido no cadastro real: há
  // empresa **sem CNPJ**, e ela ficaria invisível.
  const { buscar, dormir } = nectarFalso();
  const { items } = await buscarEmpresas('petro', { buscar, dormir });

  const nomes = items.map(e => e.nome);
  assert.ok(nomes.includes('PETROQUÍMICA NOVA LTDA'), 'empresa sem CNPJ sumiu da busca');
  assert.ok(!nomes.includes('Petronilo da Silva'), 'pessoa entrou como empresa');
});

test('o endereço vira o campo "local da obra" da proposta', () => {
  const empresa = comoEmpresa(PETROBRAS);
  assert.equal(empresa.site, 'Av. República do Chile, 65 — Rio de Janeiro/RJ');
  assert.equal(empresa.cnpj, '33000167064347');
});

test('os contatos da empresa vêm com e-mail e cargo', () => {
  const empresa = comoEmpresa(PETROBRAS);
  assert.deepEqual(empresa.contatos, [
    { id: '1', nome: 'Gabriela Antunes', email: 'gabriela@petrobras.com', departamento: 'Manutenção' }
  ]);
});

// ---------------------------------------------------------------------------
// O CASO DA QUEIXA: "petrobras" não acha por prefixo
// ---------------------------------------------------------------------------

test('A QUEIXA CONTINUA ABERTA: "petrobras" não acha, e a resposta ADMITE isso', async () => {
  // O nome começa com "PETROLEO", e o filtro do Nectar casa só por prefixo.
  // Medido no cadastro real: o índice em memória não dá conta — 1.500 contatos
  // lidos trouxeram 53 empresas, sem a Petrobras entre elas.
  //
  // O que este teste protege é a HONESTIDADE da resposta: `porTrechoDisponivel`
  // tem de vir `false`, para a tela avisar em vez de deixar o usuário concluir
  // que a empresa não está no CRM.
  const { buscar, dormir } = nectarFalso();
  const resultado = await buscarEmpresas('petrobras', { buscar, dormir });

  assert.deepEqual(resultado.items, []);
  assert.equal(resultado.porTrechoDisponivel, false, 'a resposta não pode prometer o que não faz');
});

test('a máquina do índice funciona — falta o espelho que a alimente', async () => {
  // O filtro por trecho está certo e testado; o que não escala é varrer a API a
  // cada busca. Quando a T123 trouxer o espelho persistido, é isto que ele usa.
  const { buscar, dormir } = nectarFalso();
  const resultado = await buscarEmpresas('petrobras', { buscar, dormir, esperarIndice: true });

  assert.equal(resultado.items.length, 1);
  assert.equal(resultado.items[0].nome, 'PETROLEO BRASILEIRO S A PETROBRAS');
});

test('o filtro por trecho alcança também o CNPJ', () => {
  const empresas = [comoEmpresa(PETROBRAS)];
  assert.equal(filtrarPorTrecho(empresas, '064347').length, 1);
});

test('acento e pontuação não atrapalham', () => {
  assert.equal(normalizar('PETROBRÁS S/A'), 'petrobras s a');
  assert.equal(normalizar('S.A.'), 's a');

  const empresas = [comoEmpresa(PETRORECONCAVO)];
  assert.equal(filtrarPorTrecho(empresas, 'reconcavo').length, 1);
  assert.equal(filtrarPorTrecho(empresas, 'RECÔNCAVO').length, 1);
});

// ---------------------------------------------------------------------------
// O índice não pode sabotar a busca
// ---------------------------------------------------------------------------

test('a busca por prefixo responde sozinha, sem depender de índice', async () => {
  const { buscar, chamadas, dormir } = nectarFalso();
  const { items } = await buscarEmpresas('petro', { buscar, dormir });

  assert.ok(items.length >= 2);
  // E uma requisição só: sem varredura por trás.
  assert.equal(chamadas.length, 1);
});

test('a varredura PAUSA entre páginas — sem isso, 429', async () => {
  // Nove páginas seguidas bastaram para o Nectar recusar a décima.
  const paginas = [Array(100).fill(PETROBRAS), [PETRORECONCAVO]];
  const { buscar } = nectarFalso({ paginas });
  const pausas = [];

  await buscarEmpresas('petro', { buscar, dormir: async ms => pausas.push(ms), esperarIndice: true });

  assert.equal(pausas.length, 1, 'faltou pausar entre as páginas');
  assert.ok(pausas[0] >= 1000, 'a pausa é curta demais para evitar o 429');
});

test('duas buscas simultâneas com índice frio fazem UMA varredura', async () => {
  const { buscar, chamadas, dormir } = nectarFalso();

  await Promise.all([
    buscarEmpresas('petro', { buscar, dormir, esperarIndice: true }),
    buscarEmpresas('petro', { buscar, dormir, esperarIndice: true })
  ]);

  const varreduras = chamadas.filter(c => c.includes('page=1')).length;
  assert.equal(varreduras, 1, 'disparou duas varreduras para o mesmo índice');
});

test('o 429 do Nectar vira mensagem que diz o que houve', async () => {
  const buscar = async () => ({ ok: false, status: 429, json: async () => ({}) });

  await assert.rejects(
    () => buscarEmpresas('petro', { buscar, dormir: async () => {} }),
    error => {
      assert.equal(error.statusCode, 429);
      assert.match(error.message, /limitou as consultas/i);
      return true;
    }
  );
});

test('termo curto demais recusa antes de gastar chamada', async () => {
  const { buscar, chamadas, dormir } = nectarFalso();

  await assert.rejects(
    () => buscarEmpresas('p', { buscar, dormir }),
    error => error.statusCode === 400
  );
  assert.equal(chamadas.length, 0);
});

test('a empresa é buscável por id, com os contatos dela', async () => {
  const buscar = async () => resposta([PETROBRAS]);
  const empresa = await empresaComContatos('51577031', { buscar });

  assert.equal(empresa.nome, 'PETROLEO BRASILEIRO S A PETROBRAS');
  assert.equal(empresa.contatos.length, 1);
});
