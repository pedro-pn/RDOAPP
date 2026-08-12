import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.GOOGLE_MAPS_MODE = 'real';
process.env.GOOGLE_MAPS_API_KEY = 'chave-de-teste';

const { ConfiguracaoError, conferirEndereco, distanciaDaSede, lerConfiguracao, salvarSede } =
  await import('../src/lib/comercial/configuracao.js');
const { limparCache } = await import('../src/lib/comercial/distancias.js');

/**
 * Configuração do módulo Comercial (T131).
 *
 * O endereço da sede saiu do `.env` e virou linha de banco editável por gestor.
 * O que precisa ser provado é o que a mudança arriscava quebrar:
 *
 * - **ler antes de alguém salvar** tem de devolver "em branco", não estourar —
 *   é o estado de toda instalação no primeiro dia;
 * - **salvar com o Maps desligado** tem de gravar do mesmo jeito, porque `off` é
 *   o padrão do ambiente e recusar deixaria a tela inútil no caso mais comum;
 * - **trocar de endereço** não pode deixar para trás o `placeId` do endereço
 *   velho, senão a rota sai do prédio antigo enquanto a tela mostra o novo.
 */

const SEDE = 'Rua Rosa Orsi Dalçoquio, 930, Cordeiros, Itajaí - SC';

/** Um `prisma` de mentira com a linha única em memória. */
function prismaFalso(inicial = null) {
  let linha = inicial;

  return {
    escrituras: 0,
    comercialSettings: {
      findUnique: async () => (linha ? { ...linha } : null),
      upsert: async ({ create, update }) => {
        linha = linha ? { ...linha, ...update } : { ...create };
        linha.updatedAt = new Date('2026-08-12T12:00:00Z');
        return { ...linha };
      }
    },
    get linhaAtual() {
      return linha;
    }
  };
}

/** Geocodificação de mentira, com as respostas reduzidas do Google. */
function googleFalso() {
  const chamadas = [];

  const buscar = async url => {
    chamadas.push(String(url));
    const endereco = new URL(String(url)).searchParams.get('address');

    if (endereco.startsWith('Rua Rosa Orsi')) {
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'R. Rosa Orsi Dalçoquio, 930 - Cordeiros, Itajaí - SC, Brasil',
              place_id: 'ChIJ-sede-itajai',
              types: ['street_address']
            }
          ]
        })
      };
    }

    if (endereco.startsWith('Avenida Nova')) {
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'Av. Nova, 10 - Itajaí - SC, Brasil',
              place_id: 'ChIJ-sede-nova',
              types: ['street_address']
            }
          ]
        })
      };
    }

    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
  };

  return { buscar, chamadas };
}

test.beforeEach(() => limparCache());

// ---------------------------------------------------------------------------
// Ler antes de existir
// ---------------------------------------------------------------------------

test('ler sem nunca ter salvo devolve sede em branco, não erro', async () => {
  // É o estado de toda instalação no primeiro dia. A tela sabe apresentar "não
  // configurado"; ela não sabe apresentar exceção.
  const prisma = prismaFalso();
  const config = await lerConfiguracao(prisma);

  assert.equal(config.sedeEndereco, '');
  assert.equal(config.atualizadoEm, null);
});

test('ler não cria a linha', async () => {
  // Abrir a tela não é escrever no banco.
  const prisma = prismaFalso();
  await lerConfiguracao(prisma);
  assert.equal(prisma.linhaAtual, null);
});

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

test('salvar guarda o endereço digitado E o placeId resolvido', async () => {
  const prisma = prismaFalso();
  const { buscar } = googleFalso();

  const config = await salvarSede(prisma, { id: 'u1', name: 'Gestora' }, { sedeEndereco: SEDE }, { buscar });

  // O digitado, porque é o que o gestor reconhece ao voltar na tela.
  assert.equal(config.sedeEndereco, SEDE);
  // E o oficial, porque é dele que a rota sai.
  assert.equal(config.sedePlaceId, 'ChIJ-sede-itajai');
  assert.match(config.sedeEnderecoEncontrado, /Rosa Orsi/);
  assert.equal(config.atualizadoPor, 'Gestora');
});

// O caso do Maps DESLIGADO mora em `comercial-configuracao-maps-off.test.js`:
// o modo é lido do ambiente uma vez, na carga do módulo, e não dá para virá-lo
// no meio de um arquivo. Foi tentado — e o teste, em vez de falhar, saiu para a
// internet de verdade com uma chave falsa.

test('trocar de endereço NÃO deixa para trás o placeId do anterior', async () => {
  // Este é o defeito silencioso: com o `placeId` velho preservado, a rota
  // continuaria saindo do prédio antigo enquanto a tela mostra o novo.
  const prisma = prismaFalso();
  const { buscar } = googleFalso();

  await salvarSede(prisma, null, { sedeEndereco: SEDE }, { buscar });
  const depois = await salvarSede(prisma, null, { sedeEndereco: 'Avenida Nova, 10, Itajaí' }, { buscar });

  assert.equal(depois.sedePlaceId, 'ChIJ-sede-nova');
});

test('endereço que ninguém acha zera o placeId em vez de manter o antigo', async () => {
  const prisma = prismaFalso();
  const { buscar } = googleFalso();

  await salvarSede(prisma, null, { sedeEndereco: SEDE }, { buscar });
  const depois = await salvarSede(prisma, null, { sedeEndereco: 'Rua que não existe 999' }, { buscar });

  assert.equal(depois.sedePlaceId, '');
  assert.match(depois.aviso, /Não encontrei/i);
});

test('endereço vazio ou curto demais recusa com mensagem de gente', async () => {
  const prisma = prismaFalso();

  await assert.rejects(
    () => salvarSede(prisma, null, { sedeEndereco: '   ' }),
    error => {
      assert.ok(error instanceof ConfiguracaoError);
      assert.match(error.message, /Informe o endereço/i);
      return true;
    }
  );

  await assert.rejects(
    () => salvarSede(prisma, null, { sedeEndereco: 'Rua X' }),
    error => /curto demais/i.test(error.message)
  );

  assert.equal(prisma.linhaAtual, null, 'gravou apesar de recusar');
});

test('espaço repetido é normalizado antes de gravar', async () => {
  const prisma = prismaFalso();
  const { buscar } = googleFalso();

  const config = await salvarSede(
    prisma,
    null,
    { sedeEndereco: '  Rua Rosa Orsi   Dalçoquio,  930  ' },
    { buscar }
  );

  assert.equal(config.sedeEndereco, 'Rua Rosa Orsi Dalçoquio, 930');
});

// ---------------------------------------------------------------------------
// Conferir sem gravar
// ---------------------------------------------------------------------------

test('conferir localiza sem tocar no banco', async () => {
  const prisma = prismaFalso();
  const { buscar } = googleFalso();

  const local = await conferirEndereco(SEDE, { buscar });

  assert.equal(local.placeId, 'ChIJ-sede-itajai');
  assert.equal(prisma.linhaAtual, null);
});

// ---------------------------------------------------------------------------
// A costura: distância a partir da sede gravada
// ---------------------------------------------------------------------------

test('a distância sai da sede que está no banco', async () => {
  const prisma = prismaFalso({
    sedeAddress: SEDE,
    sedePlaceId: 'ChIJ-sede-itajai'
  });

  const corpos = [];
  const buscar = async (url, opcoes = {}) => {
    if (String(url).includes('geocode')) {
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'R. Duzentos e Quatro, 4, Paranaíta - MT, Brasil',
              place_id: 'ChIJ-obra',
              types: ['establishment']
            }
          ]
        })
      };
    }
    corpos.push(JSON.parse(opcoes.body));
    return { ok: true, json: async () => ({ routes: [{ distanceMeters: 2706475 }] }) };
  };

  const resultado = await distanciaDaSede(prisma, 'UHE São Manoel', { buscar });

  assert.equal(resultado.km, 2706);
  assert.deepEqual(corpos[0].origin, { placeId: 'ChIJ-sede-itajai' });
});

// ---------------------------------------------------------------------------
// Quem pode escrever
// ---------------------------------------------------------------------------

test('as rotas que ESCREVEM configuração exigem gestor', () => {
  // Leitura estrutural, do arquivo de rotas. É crua, mas pega o que importa: um
  // caminho novo de configuração entrando com o guarda de orçamentista, que é o
  // que está logo acima no arquivo e o que o copiar-colar traria junto. A regra
  // é do módulo inteiro — o que se muda aqui vale para as propostas de todos.
  const aqui = dirname(fileURLToPath(import.meta.url));
  const rotas = readFileSync(join(aqui, '../src/routes/resources/comercial.js'), 'utf8');

  const blocos = [...rotas.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*(\w+)/g)];
  const configuracao = blocos.filter(([, , caminho]) => caminho.startsWith('/configuracao'));

  assert.ok(configuracao.length >= 3, 'as rotas de configuração sumiram do arquivo');

  for (const [, verbo, caminho, guarda] of configuracao) {
    const esperado = verbo === 'get' ? 'requireComercialEstimator' : 'requireComercialManager';
    assert.equal(guarda, esperado, `${verbo.toUpperCase()} ${caminho} está com o guarda errado`);
  }
});

test('sem sede gravada, a distância diz onde configurar', async () => {
  const prisma = prismaFalso();
  const resultado = await distanciaDaSede(prisma, 'UHE São Manoel', {
    buscar: async () => {
      throw new Error('não deveria chamar o Google');
    }
  });

  assert.equal(resultado.km, null);
  assert.match(resultado.aviso, /Configurações/i);
});
