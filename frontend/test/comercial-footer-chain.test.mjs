import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

/**
 * O rodapé-guia do levantamento (tarefa T044).
 *
 * O que precisa ser verificável: a CADEIA e a ORDEM. O botão muda de texto e
 * de destino conforme o que falta, e a ordem não é arbitrária — com mão de
 * obra e logística pendentes ao mesmo tempo, mandar para logística primeiro
 * faria o usuário refazer o trabalho, porque a logística depende da equipe
 * dimensionada.
 *
 * As mensagens são as da referência ao pé da letra. Mudá-las é divergência,
 * não melhoria — e o aceite lado a lado (T113) compara texto por texto.
 */

let server;
let footerAction;
let chainSummary;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  ({ footerAction, chainSummary } = await server.ssrLoadModule(
    '/src/pages/comercial/custos/footerChain.ts'
  ));
});

test.after(async () => {
  await server?.close();
});

const nadaPendente = { labor: false, inputs: false, logistics: false, commercial: false };
const podeSalvar = { saving: false, title: 'Limpeza química', validPricing: true, salePrice: 38139.33 };

test('mão de obra pendente manda para mão de obra', () => {
  const acao = footerAction({ ...nadaPendente, labor: true }, podeSalvar);
  assert.equal(acao.kind, 'goto');
  assert.equal(acao.label, 'Preencher itens obrigatórios da mão de obra →');
  assert.equal(acao.target, 'labor');
});

test('a ORDEM da cadeia é fixa: mão de obra vence logística', () => {
  // Se um dia isto inverter, o usuário dimensiona a logística antes de ter a
  // equipe definida — e refaz.
  const acao = footerAction(
    { ...nadaPendente, labor: true, logistics: true, inputs: true, commercial: true },
    podeSalvar
  );
  assert.equal(acao.target, 'labor');
});

test('sem mão de obra pendente, insumos vêm antes de logística', () => {
  const acao = footerAction(
    { ...nadaPendente, inputs: true, logistics: true, commercial: true },
    podeSalvar
  );
  assert.equal(acao.label, 'Revisar materiais e insumos →');
  assert.equal(acao.target, 'inputs');
});

test('logística vem antes de comissões', () => {
  const acao = footerAction({ ...nadaPendente, logistics: true, commercial: true }, podeSalvar);
  assert.equal(acao.label, 'Preencher mobilização e desmobilização →');
  assert.equal(acao.target, 'logistics');
});

test('comissões pendentes mandam para o RESUMO, não para uma seção própria', () => {
  // Comissão e indicação vivem na seção "Resumo e QQP". Mandar para uma seção
  // inexistente deixaria o botão sem destino.
  const acao = footerAction({ ...nadaPendente, commercial: true }, podeSalvar);
  assert.equal(acao.label, 'Completar comissões e indicações →');
  assert.equal(acao.target, 'summary');
});

test('o botão de atalho NUNCA fica desabilitado', () => {
  // Ele é um caminho para resolver, não uma trava. Desabilitar esconderia o
  // caminho justamente de quem está perdido.
  for (const chave of ['labor', 'inputs', 'logistics', 'commercial']) {
    const acao = footerAction(
      { ...nadaPendente, [chave]: true },
      { saving: true, title: '', validPricing: false, salePrice: 0 }
    );
    assert.equal(acao.disabled, false, `o atalho de ${chave} não pode vir desabilitado`);
  }
});

test('sem pendências, o botão vira salvar', () => {
  const acao = footerAction(nadaPendente, podeSalvar);
  assert.equal(acao.kind, 'save');
  assert.equal(acao.label, 'Salvar levantamento e criar proposta →');
  assert.equal(acao.disabled, false);
});

test('salvar exige título, precificação válida e preço maior que zero', () => {
  const semTitulo = footerAction(nadaPendente, { ...podeSalvar, title: '   ' });
  assert.equal(semTitulo.disabled, true, 'título só com espaços não vale');

  const semPreco = footerAction(nadaPendente, { ...podeSalvar, salePrice: 0 });
  assert.equal(semPreco.disabled, true, 'preço zero não pode salvar');

  const precoNegativo = footerAction(nadaPendente, { ...podeSalvar, salePrice: -1 });
  assert.equal(precoNegativo.disabled, true);

  const precificacaoInvalida = footerAction(nadaPendente, { ...podeSalvar, validPricing: false });
  assert.equal(precificacaoInvalida.disabled, true);
});

test('durante o salvamento o texto muda e o botão trava', () => {
  const acao = footerAction(nadaPendente, { ...podeSalvar, saving: true });
  assert.equal(acao.label, 'Salvando...');
  assert.equal(acao.disabled, true, 'salvar duas vezes criaria dois levantamentos');
});

test('a cadeia em texto serve ao roteiro do tutorial', () => {
  // É o roteiro do L4: o app já conhece o caminho, o tutorial só o narra.
  assert.deepEqual(chainSummary(), [
    'Preencher itens obrigatórios da mão de obra →',
    'Revisar materiais e insumos →',
    'Preencher mobilização e desmobilização →',
    'Completar comissões e indicações →',
    'Salvar levantamento e criar proposta →'
  ]);
});
