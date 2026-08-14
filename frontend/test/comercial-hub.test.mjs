/**
 * O card do módulo no hub do filtroAPP — T095, FR-024.
 *
 * A regra é declarativa: o `hub.roles` do registro lista os três papéis, e
 * `hubModulesForUser` filtra por eles. Como é declarativa, ela **some sem
 * quebrar nada** — apagar a lista de papéis não dá erro de tipo nem de teste,
 * só passa a mostrar o Comercial para a empresa inteira. É esse apagão silencioso
 * que este arquivo trava.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function carregarHub() {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule('/src/pages/hubModules.ts');
  } finally {
    await server.close();
  }
}

const usuario = moduleRoles => ({ accountType: 'INTERNAL', role: 'ADMIN', moduleRoles });

test('quem tem papel do Comercial vê o card', async () => {
  const { hubModulesForUser } = await carregarHub();

  for (const papel of ['comercial:manager', 'comercial:seller', 'comercial:viewer']) {
    const ids = hubModulesForUser(usuario([papel])).map(m => m.id);
    assert.ok(ids.includes('comercial'), `${papel} deveria ver o card`);
  }
});

test('quem NÃO tem nenhum dos três papéis não vê o card', async () => {
  const { hubModulesForUser } = await carregarHub();

  // Usuário interno legítimo, com papel de outro módulo. O card não é escondido
  // por CSS nem por rota: ele não entra na lista.
  const ids = hubModulesForUser(usuario(['equipamentos:manager'])).map(m => m.id);
  assert.ok(!ids.includes('comercial'));
});

test('sem papel nenhum, o card também não aparece', async () => {
  const { hubModulesForUser } = await carregarHub();

  assert.ok(!hubModulesForUser(usuario([])).map(m => m.id).includes('comercial'));
  assert.ok(!hubModulesForUser(null).map(m => m.id).includes('comercial'));
});
