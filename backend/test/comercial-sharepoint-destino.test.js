import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SHAREPOINT_MODE = 'real';
process.env.SHAREPOINT_BASE_FOLDER = 'ZZ - Testes';
process.env.MICROSOFT_TENANT_ID = 'tenant-de-teste';
process.env.MICROSOFT_CLIENT_ID = 'client-de-teste';
process.env.MICROSOFT_CLIENT_SECRET = 'segredo-de-teste';

const { gravarArquivos, indisponivel } = await import('../src/lib/comercial/sharepoint.js');

/**
 * Como o adaptador chega até a biblioteca — as três formas (T135).
 *
 * A forma escolhida decide **quantas descobertas** acontecem antes de gravar, e
 * é isso que separa uma permissão de menor privilégio de uma que alcança a
 * empresa inteira:
 *
 * | Configurado        | Descobertas | Permissão que basta   |
 * |--------------------|-------------|-----------------------|
 * | `DRIVE_ID`         | nenhuma     | `Sites.Selected`      |
 * | `SITE_ID`          | uma         | —                     |
 * | hostname + caminho | duas        | `Sites.ReadWrite.All` |
 *
 * `Sites.Selected` libera site a site e **restringe descoberta**: procurar o
 * site pelo endereço pode voltar 403 mesmo com o site liberado. Daí o teste que
 * mais importa aqui ser o primeiro — ele prova que, com `DRIVE_ID`, **nenhuma
 * URL de `/sites/` é tocada**. Se alguém reintroduzir a busca do site "porque é
 * mais cômodo", a instalação de menor privilégio quebra em produção, e só lá.
 *
 * A biblioteca **chega por parâmetro**, como a sede chega ao cálculo de
 * distância: o ambiente é lido uma vez na carga do módulo, então variá-lo entre
 * casos não funcionaria — foi tentado, e os casos passaram a testar todos o
 * mesmo ambiente sem reclamar.
 */

/** Um Microsoft Graph de mentira que anota cada URL pedida. */
function graphFalso() {
  const urls = [];

  const buscar = async (url, opcoes = {}) => {
    const endereco = String(url);
    urls.push(endereco);

    if (endereco.includes('/oauth2/v2.0/token')) {
      return resposta({ access_token: 'token-de-teste' });
    }
    // Busca do site pelo endereço: tem `:` logo depois do host.
    if (/\/sites\/[^/]+:/.test(endereco)) {
      return resposta({ id: 'site-descoberto-pelo-caminho' });
    }
    if (/\/sites\/.+\/drive$/.test(endereco)) {
      return resposta({ id: 'drive-descoberto-pelo-site' });
    }
    // Procura de pasta: responde que não existe, para o adaptador criar.
    if (!opcoes.method && /\/drives\/.+:\//.test(endereco)) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (opcoes.method === 'POST') return resposta({ id: `pasta-${urls.length}` });
    return resposta({});
  };

  return { buscar, urls };
}

const resposta = corpo => ({ ok: true, status: 200, json: async () => corpo });

/**
 * O `fetch` global é trocado em vez de injetado: `chamar` serve quatro funções
 * internas, e enfiar a dependência nas quatro só para observar URL seria mudar a
 * forma do código de produção por causa do teste.
 */
async function comGraphFalso(executar) {
  const original = globalThis.fetch;
  const { buscar, urls } = graphFalso();
  globalThis.fetch = buscar;
  try {
    return await executar(urls);
  } finally {
    globalThis.fetch = original;
  }
}

const SO_DRIVE = { driveId: 'b!drive-liberado-no-site', siteId: '', hostname: '', sitePath: '' };
const SO_SITE = {
  driveId: '',
  siteId: 'filtrovali.sharepoint.com,aaa,bbb',
  hostname: '',
  sitePath: ''
};
const PELO_CAMINHO = {
  driveId: '',
  siteId: '',
  hostname: 'filtrovali.sharepoint.com',
  sitePath: '/sites/ArquivosFiltrovali'
};

// ---------------------------------------------------------------------------

test('O CASO DA Sites.Selected: com DRIVE_ID, nenhuma URL de /sites/ é tocada', async () => {
  await comGraphFalso(async urls => {
    await gravarArquivos([{ fileName: 'a.pdf', bytes: Buffer.from('%PDF') }], {
      nomeDaPasta: '4418 - Petrobras',
      biblioteca: SO_DRIVE
    });

    assert.deepEqual(
      urls.filter(url => url.includes('/sites/')),
      [],
      'descobriu site com Sites.Selected — isso vira 403 em produção'
    );
    assert.ok(
      urls.some(url => url.includes('/drives/b!drive-liberado-no-site/')),
      'não usou o drive configurado'
    );
  });
});

test('com SITE_ID, descobre só a biblioteca — não o site', async () => {
  await comGraphFalso(async urls => {
    await gravarArquivos([], { nomeDaPasta: '4418', biblioteca: SO_SITE });

    assert.ok(urls.some(url => url.endsWith(`/sites/${SO_SITE.siteId}/drive`)));
    assert.ok(!urls.some(url => /\/sites\/[^/]+:/.test(url)), 'procurou o site pelo caminho');
  });
});

test('sem os dois, acha a biblioteca pelo endereço do site — SEM dois-pontos duplicado', async () => {
  // Este ramo continua existindo porque é o que estava em uso antes de a opção
  // de menor privilégio existir, e é ele que exige `Sites.ReadWrite.All`.
  //
  // A URL saía `sites/host::/sites/X:` — o `:` do template somava com o que
  // `caminhoDeUrl` já abre. Endereço inválido, e ninguém tinha visto porque o
  // SharePoint fica `off` por padrão e este ramo nunca havia rodado.
  await comGraphFalso(async urls => {
    await gravarArquivos([], { nomeDaPasta: '4418', biblioteca: PELO_CAMINHO });

    const busca = urls.find(url => url.includes('filtrovali.sharepoint.com'));
    assert.ok(busca, 'não procurou a biblioteca');
    assert.ok(!busca.includes('::'), `dois-pontos duplicado na URL: ${busca}`);
    assert.match(busca, /\/sites\/filtrovali\.sharepoint\.com:\/sites\/ArquivosFiltrovali:\/drive$/);
  });
});

test('o arquivo vai para dentro da pasta base, com o caminho codificado', async () => {
  await comGraphFalso(async urls => {
    await gravarArquivos([{ fileName: 'Proposta 4418.pdf', bytes: Buffer.from('%PDF') }], {
      nomeDaPasta: '4418 - Petrobras',
      biblioteca: SO_DRIVE
    });

    const upload = urls.find(url => url.endsWith(':/content'));
    assert.ok(upload, 'nenhum upload aconteceu');
    assert.match(upload, /ZZ%20-%20Testes\/4418%20-%20Petrobras\/Proposta%204418\.pdf/);
  });
});

// ---------------------------------------------------------------------------
// A recusa antecipada
// ---------------------------------------------------------------------------

test('sem destino nenhum, recusa antes de autenticar — e diz as três formas', () => {
  const motivo = indisponivel({ driveId: '', siteId: '', hostname: '', sitePath: '' });

  assert.match(motivo, /SHAREPOINT_DRIVE_ID/);
  assert.match(motivo, /SHAREPOINT_SITE_ID/);
  assert.match(motivo, /SHAREPOINT_HOSTNAME/);
});

test('DRIVE_ID sozinho JÁ BASTA — não cobra hostname nem caminho', () => {
  // Cobrar os dois faria a instalação de menor privilégio, que não pode
  // descobrir site, parecer incompleta — e ser "consertada" com permissão a mais.
  assert.equal(indisponivel(SO_DRIVE), '');
  assert.equal(indisponivel(SO_SITE), '');
  assert.equal(indisponivel(PELO_CAMINHO), '');
});

test('hostname sem caminho não é destino', () => {
  const motivo = indisponivel({ driveId: '', siteId: '', hostname: 'x.sharepoint.com', sitePath: '' });
  assert.match(motivo, /SHAREPOINT_SITE_PATH/);
});
