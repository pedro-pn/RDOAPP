import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

/**
 * O componente `Field` do módulo Comercial — a base da lacuna L1.
 *
 * O que precisa ser verificável, e por quê:
 *
 * A referência tem ZERO `aria-invalid` na tela de custos, que tem 465
 * controles, e concatena as pendências numa string única. O porte marca cada
 * campo e mostra a mensagem específica.
 *
 * A asserção que mais importa é a de "vazio × inválido": marcar de vermelho
 * resolve o *onde* e não resolve o *quê*. Um campo preenchido porém inválido
 * fica destacado, o usuário olha, vê texto lá dentro e não entende — é o ponto
 * de travamento mais provável do fluxo, confirmado pelo mantenedor.
 */

let server;
let render;
let Field;
let Area;
let SelectField;
let FieldPanel;
let NumberField;
let MoneyField;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  // `react-dom/server` vem por import direto: carregado pelo `ssrLoadModule`
  // ele resolve para o build CJS e quebra com "require is not defined".
  const componentes = await server.ssrLoadModule('/src/pages/comercial/components/Field.tsx');

  // Renderizar como ELEMENTO, não chamar a função: hooks (`useId`) precisam
  // do dispatcher do React, que só existe dentro do render.
  render = (Componente, props) => renderToStaticMarkup(createElement(Componente, props));
  ({ Field, Area, SelectField, FieldPanel, NumberField, MoneyField } = componentes);
});

test.after(async () => {
  await server?.close();
});

const noop = () => {};

test('campo válido não marca aria-invalid nem mostra mensagem', () => {
  const html = render(Field, { label: 'Cliente', value: 'ACME', onChange: noop });

  assert.ok(!html.includes('aria-invalid'), 'campo válido não pode ter aria-invalid');
  assert.ok(!html.includes('field-invalid'), 'campo válido não pode ter a classe vermelha');
  assert.ok(!html.includes('field-error'), 'campo válido não mostra mensagem');
});

test('campo inválido marca aria-invalid, pinta e MOSTRA a mensagem', () => {
  const html = render(Field, { label: 'CNPJ', value: '123', onChange: noop, error: 'CNPJ inválido' });

  assert.match(html, /aria-invalid="true"/, 'falta aria-invalid');
  assert.match(html, /field-group field-invalid/, 'falta a classe do destaque vermelho');
  assert.match(html, /class="field-error"/, 'falta o elemento da mensagem');
  assert.match(html, /CNPJ inválido/, 'a mensagem tem de aparecer na tela');
  assert.match(html, /role="alert"/, 'a mensagem precisa ser anunciada');
});

test('a mensagem é associada ao controle por aria-describedby', () => {
  const html = render(Field, { label: 'E-mail', value: 'x@', onChange: noop, error: 'E-mail inválido' });

  const descrito = /aria-describedby="([^"]+)"/.exec(html);
  assert.ok(descrito, 'falta aria-describedby');

  const id = descrito[1];
  assert.ok(
    html.includes(`id="${id}"`),
    'aria-describedby aponta para um id que não existe no HTML'
  );
});

test('VAZIO e INVÁLIDO são mensagens diferentes', () => {
  // É o ponto de travamento do app: o contador diz "1 campo obrigatório" e o
  // campo *está* preenchido — só que inválido. Marcar sem distinguir mantém o
  // engano.
  const vazio = render(Field, { label: 'E-mail', value: '', onChange: noop, required: true, error: 'Campo obrigatório' });
  const invalido = render(Field, { label: 'E-mail', value: 'nao-e-email', onChange: noop, required: true, error: 'E-mail inválido' });

  assert.match(vazio, /Campo obrigatório/);
  assert.match(invalido, /E-mail inválido/);
  assert.ok(
    !invalido.includes('Campo obrigatório'),
    'campo preenchido porém inválido não pode dizer que está vazio'
  );
});

test('o asterisco de obrigatório aparece', () => {
  const html = render(Field, { label: 'Cliente', value: '', onChange: noop, required: true });
  assert.match(html, /survey-required-marker/);
});

test('campo numérico zerado começa vazio para a digitação não virar 01', () => {
  const html = render(NumberField, {
    label: 'Quantidade',
    value: 0,
    onChange: noop
  });

  assert.match(html, /type="number"/);
  assert.match(html, /value=""/);
  assert.ok(!html.includes('value="0"'), 'zero inicial não pode ficar à esquerda');
});

test('campo monetário sempre exibe a máscara de reais', () => {
  const html = render(MoneyField, {
    label: 'Adicional',
    value: 1250.5,
    onChange: noop
  });

  assert.match(html, /R\$\s*1\.250,50/);
});

test('a dica cede a vez para a mensagem de erro', () => {
  // Dois textos empilhados competem pela atenção justamente quando o usuário
  // mais precisa de um só.
  const comDica = render(Field, { label: 'CNPJ', value: '', onChange: noop, hint: 'Somente números' });
  assert.match(comDica, /Somente números/);

  const comErro = render(Field, {
      label: 'CNPJ',
      value: '1',
      onChange: noop,
      hint: 'Somente números',
      error: 'CNPJ inválido'
    });
  assert.match(comErro, /CNPJ inválido/);
  assert.ok(!comErro.includes('Somente números'), 'a dica não pode disputar com o erro');
});

test('Area, SelectField e FieldPanel seguem a mesma regra', () => {
  const area = render(Area, { label: 'Descrição', value: '', onChange: noop, error: 'Campo obrigatório' });
  assert.match(area, /aria-invalid="true"/);
  assert.match(area, /class="field-error"/);

  const select = render(SelectField, {
      label: 'Consultor de Vendas',
      value: '',
      onChange: noop,
      options: [{ value: 'a', label: 'Ana' }],
      error: 'Campo obrigatório'
    });
  assert.match(select, /aria-invalid="true"/);
  assert.match(select, /class="field-error"/);

  // Grupo sem borda própria usa o painel, senão não há o que pintar.
  const painel = render(FieldPanel, { label: 'Serviços', error: 'Selecione ao menos um', children: null });
  assert.match(painel, /field-invalid-panel/);
  assert.match(painel, /Selecione ao menos um/);
});

test('SelectField com uma opção só continua sendo select', () => {
  // É o caso do vendedor no campo "Consultor de Vendas": ele recebe apenas o
  // próprio nome. O controle continua o mesmo do inventário — muda o conjunto
  // de opções, não o elemento.
  const html = render(SelectField, {
      label: 'Consultor de Vendas',
      value: 'u1',
      onChange: noop,
      options: [{ value: 'u1', label: 'Ana Souza' }]
    });

  assert.match(html, /<select/);
  assert.match(html, /Ana Souza/);
});
