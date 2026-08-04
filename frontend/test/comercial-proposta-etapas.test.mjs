import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * As 7 etapas da proposta e a trava de avanço (tarefas T055, T056, T057).
 *
 * A trava aqui é o **oposto** da tela de custos, e a diferença é deliberada: lá as
 * abas são livres porque o levantamento é uma calculadora; aqui a proposta é um
 * documento montado em ordem, e etapa incompleta não avança.
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
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/etapas.ts');
});

test.after(async () => {
  await server?.close();
});

const completo = {
  seller: 'u1',
  date: '2026-08-03',
  client: 'Cliente S.A.',
  cnpj: '11.222.333/0001-81',
  contact: 'Ana',
  email: 'ana@cliente.com.br',
  site: 'Unidade industrial, Volta Redonda/RJ'
};

test('as 7 etapas estão na ordem da referência', () => {
  assert.deepEqual(
    mod.ETAPAS.map(e => e.value),
    ['cliente', 'escopo', 'responsabilidades', 'prazos', 'tecnica', 'comercial', 'revisao']
  );
});

test('formulário completo não tem pendência', () => {
  assert.deepEqual(mod.pendenciasDoCliente(completo), []);
});

test('cada obrigatório vazio produz UMA pendência endereçada', () => {
  for (const campo of ['seller', 'date', 'client', 'contact', 'site', 'cnpj', 'email']) {
    const pendencias = mod.pendenciasDoCliente({ ...completo, [campo]: '' });
    assert.equal(pendencias.length, 1, campo);
    assert.equal(pendencias[0].campo, campo);
  }
});

test('vazio e inválido são DOIS estados, com mensagens diferentes', () => {
  // Trocar os dois faz o usuário procurar erro de digitação num campo que ele
  // simplesmente não preencheu.
  const vazio = mod.pendenciasDoCliente({ ...completo, email: '' })[0];
  const invalido = mod.pendenciasDoCliente({ ...completo, email: 'ana@' })[0];

  assert.match(vazio.mensagem, /Informe/);
  assert.match(invalido.mensagem, /válido/);
  assert.notEqual(vazio.mensagem, invalido.mensagem);
});

test('CNPJ confere os dígitos verificadores, não só a contagem', () => {
  // A referência conferia só o comprimento. O CNPJ vai impresso no documento
  // fiscal: um dígito trocado inutiliza a proposta inteira.
  assert.equal(mod.cnpjValido('11.222.333/0001-81'), true);
  assert.equal(mod.cnpjValido('11.222.333/0001-82'), false, 'verificador errado');
  assert.equal(mod.cnpjValido('11222333000181'), true, 'sem máscara também vale');
  assert.equal(mod.cnpjValido('1122233300018'), false, '13 dígitos');
  assert.equal(mod.cnpjValido('11111111111111'), false, 'todos iguais');
});

test('a máscara do CNPJ vai se formando enquanto se digita', () => {
  assert.equal(mod.formatarCnpj('11'), '11');
  assert.equal(mod.formatarCnpj('11222'), '11.222');
  assert.equal(mod.formatarCnpj('11222333'), '11.222.333');
  assert.equal(mod.formatarCnpj('112223330001'), '11.222.333/0001');
  assert.equal(mod.formatarCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(mod.formatarCnpj('112223330001819999'), '11.222.333/0001-81', 'não passa de 14');
});

test('e-mail exige arroba e domínio com ponto', () => {
  assert.equal(mod.emailValido('ana@cliente.com.br'), true);
  assert.equal(mod.emailValido('ana@cliente'), false);
  assert.equal(mod.emailValido('ana cliente@x.com'), false);
  assert.equal(mod.emailValido('  ana@cliente.com  '), true, 'espaço nas pontas não conta');
});

test('o rodapé diz quantos campos faltam, no texto da referência', () => {
  assert.equal(mod.rotuloDoAvanco([], false), 'Avançar →');
  assert.equal(mod.rotuloDoAvanco([], true), 'Finalizar proposta →');
  assert.equal(
    mod.rotuloDoAvanco([{ campo: 'a', mensagem: 'x' }], false),
    'Preencha 1 campo obrigatório'
  );
  assert.equal(
    mod.rotuloDoAvanco([{ campo: 'a', mensagem: 'x' }, { campo: 'b', mensagem: 'y' }], false),
    'Preencha 2 campos obrigatórios'
  );
});

test('etapa ainda não portada não trava o usuário', () => {
  // Uma trava que bloqueia sem ter o que validar prenderia o usuário numa etapa
  // em branco, sem nada para preencher e sem saída.
  //
  // Escopo, responsabilidades e prazos SAÍRAM desta lista quando foram portadas:
  // era exatamente para isso que este teste existia. Quem portar Técnica,
  // Comercial ou Revisão vai vê-lo falhar, e é o aviso de que falta ligar a
  // validação da etapa nova em `pendenciasDaEtapa`.
  for (const etapa of ['tecnica', 'comercial', 'revisao']) {
    assert.deepEqual(mod.pendenciasDaEtapa(etapa, {}), [], etapa);
  }
});

// ---------------------------------------------------------------------------
// Etapas 2, 3 e 4
// ---------------------------------------------------------------------------

test('escopo: item pela metade não passa', () => {
  // Um item sem descrição atravessa para o documento como uma seção 2.x
  // numerada e vazia — o cliente vê o número e não vê o serviço.
  const itens = [{ title: 'Flushing', description: '' }];
  const pendencias = mod.pendenciasDoEscopo('Limpeza química', itens);

  assert.equal(pendencias.length, 1);
  assert.equal(pendencias[0].campo, 'escopo[0].description');
});

test('escopo: o endereço da pendência carrega o ÍNDICE do item', () => {
  // Sem o índice, três serviços incompletos produziriam três mensagens
  // idênticas e nenhuma diria qual deles.
  const itens = [
    { title: 'A', description: 'ok' },
    { title: '', description: '' }
  ];
  const campos = mod.pendenciasDoEscopo('Título', itens).map(p => p.campo);

  assert.deepEqual(campos, ['escopo[1].title', 'escopo[1].description']);
});

test('escopo: título da proposta é obrigatório junto com os itens', () => {
  const pendencias = mod.pendenciasDoEscopo('  ', [{ title: 'A', description: 'B' }]);
  assert.deepEqual(pendencias.map(p => p.campo), ['title']);
});

test('responsabilidades: linha em branco não conta como preenchida', () => {
  // Mais estrito que a referência, que exigia só a existência da linha. Linha
  // vazia vira obrigação sem texto no documento.
  assert.equal(mod.pendenciasDasResponsabilidades([{ item: '   ' }]).length, 1);
  assert.equal(mod.pendenciasDasResponsabilidades([]).length, 1);
  assert.equal(mod.pendenciasDasResponsabilidades([{ item: 'Andaimes' }]).length, 0);
});

test('responsabilidades: uma linha preenchida entre várias vazias basta', () => {
  const linhas = [{ item: '' }, { item: 'Energia elétrica' }, { item: '' }];
  assert.deepEqual(mod.pendenciasDasResponsabilidades(linhas), []);
});

test('prazos: os cinco campos são obrigatórios', () => {
  const completo = {
    attendance: 'até 10 dias',
    mobilization: '7 dias',
    permanence: '12 dias corridos',
    execution: '10 dias trabalhados',
    workday: 'Segunda a sexta, 8h às 18h'
  };
  assert.deepEqual(mod.pendenciasDosPrazos(completo), []);

  for (const campo of Object.keys(completo)) {
    const pendencias = mod.pendenciasDosPrazos({ ...completo, [campo]: '' });
    assert.equal(pendencias.length, 1, campo);
    assert.equal(pendencias[0].campo, campo);
  }
});

test('pendenciasDaEtapa despacha para a etapa certa', () => {
  const form = { title: '', attendance: '' };
  const escopo = { itens: [{ title: '', description: '' }], responsabilidades: [] };

  assert.ok(mod.pendenciasDaEtapa('escopo', form, escopo).length > 0);
  assert.equal(mod.pendenciasDaEtapa('responsabilidades', form, escopo).length, 1);
  assert.equal(mod.pendenciasDaEtapa('prazos', form, escopo).length, 5);
  // As três ainda não portadas continuam sem travar.
  assert.deepEqual(mod.pendenciasDaEtapa('tecnica', form, escopo), []);
});

test('a matriz aceita "N/A" como responsável', () => {
  // Há obrigação que não cabe a ninguém no contrato e precisa constar assim
  // mesmo, para não parecer esquecimento.
  assert.ok(mod.RESPONSAVEIS.includes('N/A'));
  assert.deepEqual(mod.linhaVazia(), { item: '', owner: 'Filtrovali', note: '' });
});
