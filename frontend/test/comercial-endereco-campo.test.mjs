import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

/**
 * O campo de endereço com sugestões (T134).
 *
 * O componente tem **duas formas**, e a divisão não é estética:
 *
 * - `EnderecoField` — rótulo, dica e erro. A forma de formulário, usada na
 *   configuração da sede.
 * - `EnderecoInput` — o combobox cru. É o que cabe numa célula da tabela de
 *   destinos do levantamento, onde o rótulo é o cabeçalho da coluna e não pode
 *   haver texto de apoio embaixo do campo.
 *
 * Usar a forma de formulário dentro da tabela é o erro que este arquivo tranca:
 * ela traria um `<label>` e um `field-group` para dentro do `<td>`, quebrando o
 * alinhamento das colunas.
 *
 * A busca em si — espera entre teclas, piso de caracteres, resposta atrasada
 * descartada — é comportamento de navegador e está provada do lado do servidor,
 * em `backend/test/comercial-distancias.test.js`. Aqui é a marcação.
 */

let server;
let render;
let EnderecoField;
let EnderecoInput;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const componentes = await server.ssrLoadModule(
    '/src/pages/comercial/components/EnderecoField.tsx'
  );

  render = (Componente, props) => renderToStaticMarkup(createElement(Componente, props));
  ({ EnderecoField, EnderecoInput } = componentes);
});

test.after(async () => {
  await server?.close();
});

test('o campo se anuncia como combobox de lista', () => {
  const html = render(EnderecoInput, { value: '', onChange: () => {} });

  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  // Fechado enquanto não há sugestão: `aria-expanded` mentindo faria o leitor de
  // tela anunciar uma lista que não existe.
  assert.match(html, /aria-expanded="false"/);
});

test('sem sugestões não existe lista no documento', () => {
  const html = render(EnderecoInput, { value: 'Rua Rosa Orsi', onChange: () => {} });
  assert.doesNotMatch(html, /role="listbox"/);
});

test('A FORMA DE TABELA não traz rótulo nem field-group', () => {
  // É o que a mantém alinhada dentro do `<td>`.
  const html = render(EnderecoInput, {
    value: '',
    onChange: () => {},
    'aria-label': 'Endereço'
  });

  assert.doesNotMatch(html, /<label/);
  assert.doesNotMatch(html, /field-group/);
  assert.match(html, /aria-label="Endereço"/);
});

test('a forma de formulário traz rótulo ligado ao campo', () => {
  const html = render(EnderecoField, {
    label: 'Endereço',
    value: '',
    onChange: () => {},
    hint: 'Ainda não configurado neste ambiente.'
  });

  assert.match(html, /field-group/);
  const idDoLabel = /<label for="([^"]+)"/.exec(html)?.[1];
  assert.ok(idDoLabel, 'o rótulo não aponta para campo nenhum');
  assert.match(html, new RegExp(`id="${idDoLabel}"[^>]*role="combobox"|role="combobox"[^>]*id="${idDoLabel}"`));
  assert.match(html, /Ainda não configurado neste ambiente\./);
});

test('erro substitui a dica e é anunciado', () => {
  const html = render(EnderecoField, {
    label: 'Endereço',
    value: 'Rua X',
    onChange: () => {},
    hint: 'dica que não deve aparecer',
    error: 'O endereço da sede está curto demais para ser encontrado.'
  });

  assert.match(html, /field-invalid/);
  assert.match(html, /role="alert"/);
  assert.match(html, /curto demais/);
  assert.doesNotMatch(html, /dica que não deve aparecer/);
});

test('o autocomplete do NAVEGADOR fica desligado', () => {
  // Senão a lista do Chrome cobre a do Google, e o usuário escolhe do histórico
  // dele achando que escolheu um endereço reconhecido.
  // Sem distinguir caixa: este renderizador de teste devolve o atributo como
  // foi escrito no JSX (`autoComplete`), e HTML não diferencia maiúscula de
  // minúscula em nome de atributo.
  const html = render(EnderecoInput, { value: '', onChange: () => {} });
  assert.match(html, /autocomplete="off"/i);
});
