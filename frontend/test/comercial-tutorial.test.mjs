/**
 * O tutorial permanente do módulo e a dívida do login — T096–T098a.
 *
 * O que se prova aqui:
 *
 * - o roteiro cobre os **dois pontos que a T097 exige** — a cadeia do rodapé e
 *   a armadilha do CNPJ/e-mail —, porque um tutorial que não os cobre passa por
 *   cima justamente do que trava quem nunca usou a tela;
 * - passo que aponta para elemento ausente **é descartado**, e não fica mudo;
 * - o marcador de "já viu" **não vem do `localStorage`** (FR-025a);
 * - o login recusa campo vazio **antes** do servidor, com mensagem por campo.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let roteiro;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  roteiro = await server.ssrLoadModule('/src/pages/comercial/roteiroDoTutorial.ts');
});

test.after(async () => {
  await server?.close();
});

const textos = passos =>
  passos.map(passo => `${passo.popover.title} ${passo.popover.description}`).join(' ');

test('o roteiro dos custos ensina a CADEIA do rodapé, na ordem', () => {
  // O achado do roteiro (§2.3): o app já sabe o caminho e já sabe o que falta.
  // O mantenedor confirmou que segue a cadeia em vez de clicar nas abas — é o
  // caminho real, e por isso é o que o tutorial ensina.
  const texto = textos(roteiro.ROTEIRO_DOS_CUSTOS);

  assert.match(texto, /rodapé é um guia/i);
  assert.match(texto, /mão de obra.*materiais.*mobilização.*comissões.*salvar/i);
});

test('o roteiro da proposta cobre a armadilha do campo PREENCHIDO e inválido', () => {
  // O travamento mais provável do app: o contador acusa pendência num campo que
  // parece cheio. O tutorial precisa dizer que "obrigatório" e "inválido" são
  // dois estados diferentes — senão a pessoa relê o campo e não vê nada errado.
  const texto = textos(roteiro.ROTEIRO_DA_PROPOSTA);

  assert.match(texto, /preenchido/i);
  assert.match(texto, /CNPJ/);
  assert.match(texto, /14 dígitos/);
});

test('todo passo aponta para um seletor, e nenhum aponta para dois lugares', () => {
  const todos = [
    ...roteiro.ROTEIRO_DA_ENTRADA,
    ...roteiro.ROTEIRO_DOS_CUSTOS,
    ...roteiro.ROTEIRO_DA_PROPOSTA
  ];

  for (const passo of todos) {
    assert.equal(typeof passo.element, 'string', 'passo sem elemento não destaca nada');
    assert.ok(passo.popover.title, 'passo sem título aparece como balão vazio');
    assert.ok(passo.popover.description.length > 40, 'descrição curta demais para ensinar');
  }
});

test('passo cujo elemento não existe é DESCARTADO, não fica mudo', () => {
  // `driver.js` não reclama de seletor que não casa: ele mostra um balão preso
  // no canto, ou pula sem avisar. Filtrar antes é o que faz o mesmo roteiro
  // servir à proposta com e sem a prévia aberta.
  const existentes = new Set(['.com-menu']);
  const filtrados = roteiro.passosPresentes(roteiro.ROTEIRO_DA_ENTRADA, seletor =>
    existentes.has(seletor)
  );

  assert.equal(filtrados.length, 1);
  assert.equal(filtrados[0].element, '.com-menu');
});

test('o marcador de "já viu" NÃO passa pelo localStorage', async () => {
  // FR-025a. No navegador, dois usuários da mesma máquina compartilhariam o
  // marcador — o segundo nunca veria o tutorial — e o mesmo usuário o veria de
  // novo em outro computador. O tutorial acompanha a pessoa.
  const fonte = await server
    .transformRequest('/src/pages/comercial/TutorialDoModulo.tsx')
    .then(r => r.code);

  assert.doesNotMatch(fonte, /localStorage/);
  assert.match(fonte, /tutorialComercialVisto/);
  assert.match(fonte, /marcarTutorialComercialVisto/);
});

test('rever o tutorial não marca como visto', async () => {
  // O botão é consulta voluntária. Marcar ali transformaria "quis rever" em
  // "nunca mais aparece", que é o oposto do que ele significa.
  const fonte = await server
    .transformRequest('/src/pages/comercial/TutorialDoModulo.tsx')
    .then(r => r.code);

  assert.match(fonte, /abrir\(false\)/, 'o botão abre sem marcar');
  assert.match(fonte, /abrir\(true\)/, 'a abertura automática marca');
});

/* ------------------------------------------------------------------------- *
 * T098 — a dívida do login do filtroAPP, corrigida na fonte.
 * ------------------------------------------------------------------------- */

test('campo vazio no login é "obrigatório", com mensagem por campo', async () => {
  const { validateLoginFields } = await server.ssrLoadModule('/src/auth/loginValidation.ts');

  assert.deepEqual(validateLoginFields('', ''), {
    username: 'Informe o usuário.',
    password: 'Informe a senha.'
  });
  assert.deepEqual(validateLoginFields('joao', ''), { password: 'Informe a senha.' });
  assert.deepEqual(validateLoginFields('', 'senha'), { username: 'Informe o usuário.' });
  assert.deepEqual(validateLoginFields('joao', 'senha'), {});
});

test('espaço não conta como preenchimento', async () => {
  // Sem `trim`, uma barra de espaço passaria daqui e seria recusada pelo
  // servidor com "usuário ou senha inválidos" — de volta à mensagem que não diz
  // qual campo é.
  const { validateLoginFields } = await server.ssrLoadModule('/src/auth/loginValidation.ts');

  assert.deepEqual(validateLoginFields('   ', '  '), {
    username: 'Informe o usuário.',
    password: 'Informe a senha.'
  });
});

test('o login usa .field-invalid, .field-error e aria-invalid — tinha zero', async () => {
  const fonte = await server.transformRequest('/src/pages/LoginPage.tsx').then(r => r.code);

  assert.match(fonte, /field-group field-invalid/);
  assert.match(fonte, /field-error/);
  assert.match(fonte, /aria-invalid/);
  // `aria-describedby` liga o campo à mensagem: sem ele o leitor de tela anuncia
  // "inválido" e não lê o porquê.
  assert.match(fonte, /aria-describedby/);
});
