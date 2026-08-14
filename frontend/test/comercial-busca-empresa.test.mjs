/**
 * A busca de empresa no CRM, na etapa Cliente — T121a.
 *
 * O que este arquivo cobre são as **duas decisões que erram em silêncio**:
 *
 * 1. O aviso sobre o alcance da busca. Sem o espelho do CRM (T123), o Nectar
 *    casa só pelo **começo** do nome. Quem procura "brasileiro", não acha a
 *    Petrobras e não é avisado, conclui que a empresa não está no CRM — e
 *    cadastra uma segunda.
 * 2. O que a escolha grava. É daqui que saem `companyId` e `contactId`, e sem
 *    eles a finalização recusa: digitar o nome à mão nunca os produziria.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let mod;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  mod = await server.ssrLoadModule('/src/pages/comercial/proposta/buscaDeEmpresa.ts');
});

test.after(async () => {
  await server?.close();
});

test('com o espelho pronto, a busca não avisa nada', () => {
  assert.equal(
    mod.avisoDoAlcance({ porTrechoDisponivel: true, indiceEmPreparo: false }),
    ''
  );
});

test('sem o espelho, o aviso diz o que a busca ALCANÇA — com exemplo', () => {
  const aviso = mod.avisoDoAlcance({ porTrechoDisponivel: false, indiceEmPreparo: false });

  assert.match(aviso, /início do nome/);
  // O exemplo não é enfeite: "a busca é por prefixo" não diz a ninguém o que
  // fazer diferente. O par Petrobras/brasileiro diz.
  assert.match(aviso, /Petrobras/);
});

test('índice em preparo diz para tentar de novo, não que a busca é limitada', () => {
  const aviso = mod.avisoDoAlcance({ porTrechoDisponivel: false, indiceEmPreparo: true });

  assert.match(aviso, /tente de novo/i);
  assert.notEqual(
    aviso,
    mod.avisoDoAlcance({ porTrechoDisponivel: false, indiceEmPreparo: false }),
    'os dois estados são diferentes e a mensagem precisa diferenciá-los'
  );
});

test('escolher a empresa grava o companyId — é ele que destrava a finalização', () => {
  const dados = mod.dadosDaEmpresa({
    id: '9911',
    nome: 'PETROLEO BRASILEIRO S A PETROBRAS',
    cnpj: '33.000.167/0001-01',
    site: 'Av. República do Chile, 65 — Rio de Janeiro/RJ',
    contatos: []
  });

  assert.equal(dados.companyId, '9911');
  assert.equal(dados.client, 'PETROLEO BRASILEIRO S A PETROBRAS');
  assert.equal(dados.cnpj, '33.000.167/0001-01');
  assert.equal(dados.site, 'Av. República do Chile, 65 — Rio de Janeiro/RJ');
});

test('trocar de empresa APAGA o contato anterior', () => {
  // O caso silencioso: manter o contato da empresa anterior mandaria ao CRM um
  // vínculo que não existe, e ao documento o nome de quem não trabalha lá.
  const dados = mod.dadosDaEmpresa({
    id: '2',
    nome: 'Outra',
    cnpj: '',
    site: '',
    contatos: []
  });

  assert.equal(dados.contactId, '');
  assert.equal(dados.contact, '');
  assert.equal(dados.email, '');
  assert.equal(dados.department, '');
});

test('escolher o contato grava o contactId e não toca na empresa', () => {
  const dados = mod.dadosDoContato({
    id: '4477',
    nome: 'Maria Souza',
    email: 'maria@petrobras.com.br',
    departamento: 'Manutenção'
  });

  assert.deepEqual(dados, {
    contactId: '4477',
    contact: 'Maria Souza',
    email: 'maria@petrobras.com.br',
    department: 'Manutenção'
  });
  // Nada de `client` nem `cnpj`: escolher o contato não pode reescrever a
  // empresa, que o vendedor pode ter corrigido à mão.
  assert.equal('client' in dados, false);
  assert.equal('cnpj' in dados, false);
});

test('o mínimo de caracteres é o mesmo que o servidor exige', () => {
  // O servidor recusa com 400 abaixo de 2. Divergir aqui produziria uma viagem
  // que só volta com erro, ou um campo que recusa o que o servidor aceitaria.
  assert.equal(mod.MINIMO_PARA_BUSCAR, 2);
});
