/**
 * A matriz completa de permissão — T108, T110b.
 *
 * O oráculo é [`contracts/api-contracts.md`](../../specs/009-modulo-comercial/contracts/api-contracts.md),
 * e este arquivo existe porque a matriz de lá **era prosa**: cada célula estava
 * escrita, nenhuma estava provada junta. O `comercial-access.test.js` cobre
 * casos avulsos da política; o que faltava era a tabela inteira, e a garantia de
 * que **nenhuma rota esquece o portão**.
 *
 * São dois níveis, e os dois importam por motivos diferentes:
 *
 * 1. **A política** (`access.js`) — 3 papéis × 2 entidades × (criar, ler,
 *    editar, finalizar), mais documentos. Erro aqui é regra errada.
 * 2. **A declaração das rotas** — cada caminho do router contra o middleware que
 *    a matriz manda. Erro aqui é regra certa que ninguém chamou, que é o modo
 *    mais provável de vazar: a política continua impecável e a porta fica aberta.
 *
 * O segundo nível é textual de propósito. Não há harness HTTP neste repositório
 * e o plano fixa **nenhuma dependência de teste nova**; ler a declaração do
 * router é o que dá para provar sem inventar infraestrutura — e é o suficiente
 * para pegar rota nova sem portão, que é o risco real.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROLE_MANAGER,
  ROLE_SELLER,
  ROLE_VIEWER,
  canFinalize,
  canRead,
  canWrite,
  isEstimator,
  serializeForUser
} from '../src/lib/comercial/access.js';

const aqui = dirname(fileURLToPath(import.meta.url));

const gestor = { id: 'g1', moduleRoles: [ROLE_MANAGER] };
const vendedorA = { id: 'va', moduleRoles: [ROLE_SELLER] };
const vendedorB = { id: 'vb', moduleRoles: [ROLE_SELLER] };
const consulta = { id: 'c1', moduleRoles: [ROLE_VIEWER] };

const deA = { id: 'r1', createdByUserId: 'va', status: 'RASCUNHO', totalValue: '1000.00' };
const deB = { id: 'r2', createdByUserId: 'vb', status: 'RASCUNHO', totalValue: '2000.00' };

/* ------------------------------------------------------------------------- *
 * Nível 1 — a política, célula a célula.
 * ------------------------------------------------------------------------- */

/**
 * A matriz do contrato, transcrita.
 *
 * Escrita como dado, e não como uma sequência de `assert`, porque é assim que
 * ela se lê ao lado do `api-contracts.md` — e porque célula esquecida numa
 * tabela salta aos olhos, enquanto `assert` faltando não.
 */
const MATRIZ = [
  // [ação, ator, registro, esperado]
  ['ler', gestor, deB, true],
  ['ler', vendedorA, deA, true],
  ['ler', vendedorA, deB, false],
  ['ler', consulta, deA, false],

  ['editar', gestor, deB, true],
  ['editar', vendedorA, deA, true],
  ['editar', vendedorA, deB, false],
  ['editar', consulta, deA, false],

  ['finalizar', gestor, deB, true],
  ['finalizar', vendedorA, deA, true],
  ['finalizar', vendedorA, deB, false],
  ['finalizar', consulta, deA, false]
];

const APLICAR = {
  ler: canRead,
  editar: canWrite,
  finalizar: canFinalize
};

test('a matriz de política vale célula a célula, para as duas entidades', () => {
  // As duas entidades passam pelas MESMAS funções: a autoria vale para
  // levantamento e proposta, e não só para a proposta como a §12.5 previa.
  for (const [acao, ator, registro, esperado] of MATRIZ) {
    assert.equal(
      APLICAR[acao](ator, registro),
      esperado,
      `${acao}: ${ator.id} sobre ${registro.id} deveria ser ${esperado}`
    );
  }
});

test('criar é do orçamentista — consulta não cria em nenhuma entidade', () => {
  assert.equal(isEstimator(gestor), true);
  assert.equal(isEstimator(vendedorA), true);
  assert.equal(isEstimator(consulta), false);
});

test('o vendedor não alcança registro alheio nem sabendo o id', () => {
  // O caso do endereço direto: a rota de item não pode devolver 404 genérico
  // nem tela vazia — a política nega, e a rota traduz em 403.
  assert.equal(canRead(vendedorA, deB), false);
  assert.equal(canWrite(vendedorB, deA), false);
});

test('consulta recebe a proposta SEM os valores — removidos, não escondidos', () => {
  const visto = serializeForUser(consulta, deB);

  assert.equal('totalValue' in visto, false, 'o campo não pode existir na resposta');
  // Para quem pode ver, continua lá: a supressão é por papel, não por rota.
  assert.equal(serializeForUser(gestor, deB).totalValue, '2000.00');
});

/**
 * Documentos: as quatro células da matriz, no **ponto de decisão real**.
 *
 * A primeira versão deste teste chamava `canDownloadDocument` direto e falhou —
 * o predicado responde sobre o **papel**, não sobre a autoria, e devolve `true`
 * para orçamentista em qualquer documento. A rota não vaza: `baixarDocumento`
 * compõe `canRead` (autoria) com ele. Quem estava errado era o teste, e o achado
 * virou um aviso no próprio predicado — usá-lo sozinho como portão abriria a
 * proposta de um vendedor para outro.
 */
test('documentos: as quatro células, pelo caminho que a rota usa', async () => {
  const { baixarDocumento } = await import('../src/lib/comercial/documentos.js');

  const documento = (kind, proposal) => ({
    proposalDocument: {
      findUnique: async () => ({ id: 'd1', kind, storagePath: 'x', proposal })
    }
  });
  const baixa = async (ator, kind, proposal) => {
    try {
      await baixarDocumento(documento(kind, proposal), ator, 'd1');
      return 200;
    } catch (erro) {
      return erro.statusCode;
    }
  };

  // O gestor e o autor baixam os dois. Ler o arquivo falha depois do portão —
  // o que interessa aqui é passar por ele, não o disco.
  assert.notEqual(await baixa(gestor, 'COMERCIAL', deB), 403);
  assert.notEqual(await baixa(vendedorA, 'COMERCIAL', deA), 403);

  // Vendedor no documento de OUTRO: 403 nos dois tipos. É a célula que a
  // matriz marca em negrito, e a que um portão só de papel deixaria passar.
  assert.equal(await baixa(vendedorA, 'COMERCIAL', deB), 403);
  assert.equal(await baixa(vendedorA, 'TECNICA', deB), 403);

  // Consulta: técnica passa, comercial não. Liberar a comercial contornaria o
  // FR-030 por outra porta — ela traz preços, pagamento e valor total.
  assert.notEqual(await baixa(consulta, 'TECNICA', deB), 403);
  assert.equal(await baixa(consulta, 'COMERCIAL', deB), 403);
});

/* ------------------------------------------------------------------------- *
 * Nível 2 — nenhuma rota sem portão.
 * ------------------------------------------------------------------------- */

const router = readFileSync(join(aqui, '../src/routes/resources/comercial.js'), 'utf8');

/**
 * O portão de cada rota, como o `api-contracts.md` manda.
 *
 * `'acesso'` = os três papéis, pelo `router.use(requireComercialAccess)` do topo.
 * Rota que não estiver aqui **falha o teste**: é a mesma regra dos outros
 * guardas do módulo — item novo tem de ser declarado, senão entra em silêncio.
 */
const PORTAO_ESPERADO = {
  'GET /status': 'acesso',
  'GET /levantamentos': 'requireComercialEstimator',
  'POST /levantamentos': 'requireComercialEstimator',
  'GET /levantamentos/:id': 'requireComercialEstimator',
  'PUT /levantamentos/:id': 'requireComercialEstimator',
  'POST /levantamentos/:id/arquivar': 'requireComercialEstimator',
  'POST /levantamentos/:id/desarquivar': 'requireComercialEstimator',
  'GET /propostas': 'acesso',
  'POST /propostas': 'requireComercialEstimator',
  'GET /propostas/proximo-numero': 'requireComercialEstimator',
  'GET /propostas/:id': 'requireComercialEstimator',
  'PUT /propostas/:id': 'requireComercialEstimator',
  'POST /propostas/:id/arquivar': 'requireComercialEstimator',
  'POST /propostas/:id/desarquivar': 'requireComercialEstimator',
  'GET /propostas/:codigo/revisao': 'requireComercialEstimator',
  'POST /propostas/documentos': 'requireComercialEstimator',
  'POST /propostas/finalizar': 'requireComercialEstimator',
  'POST /propostas/previa.pdf': 'requireComercialEstimator',
  'GET /propostas/:id/anexos': 'requireComercialEstimator',
  'POST /propostas/:id/anexos': 'requireComercialEstimator',
  'DELETE /propostas/:id/anexos/:anexoId': 'requireComercialEstimator',
  'GET /documentos/:id': 'acesso',
  'GET /consultores': 'requireComercialEstimator',
  'POST /escopo/fotos': 'requireComercialEstimator',
  'GET /escopo/fotos/:id': 'requireComercialEstimator',
  'GET /crm/empresas': 'requireComercialEstimator',
  'GET /crm/empresas/:id': 'requireComercialEstimator',
  'GET /nectar/funis': 'requireComercialEstimator',
  'GET /numeracao/status': 'requireComercialEstimator',
  'GET /distancia': 'requireComercialEstimator',
  'GET /enderecos/sugestoes': 'requireComercialEstimator',
  'GET /configuracao': 'requireComercialEstimator',
  'PUT /configuracao/sede': 'requireComercialManager',
  'POST /configuracao/sede/localizar': 'requireComercialManager',
  'GET /tutorial': 'acesso',
  'POST /tutorial/visto': 'acesso'
};

/** Lê as rotas declaradas no router, com o middleware que vem logo depois. */
function rotasDeclaradas() {
  const encontradas = new Map();
  const padrao = /router\.(get|post|put|delete)\(\s*'([^']+)',\s*(\w+)?/g;

  for (const achado of router.matchAll(padrao)) {
    const [, metodo, caminho, seguinte] = achado;
    const portao =
      seguinte === 'requireComercialManager' || seguinte === 'requireComercialEstimator'
        ? seguinte
        : 'acesso';
    encontradas.set(`${metodo.toUpperCase()} ${caminho}`, portao);
  }

  return encontradas;
}

test('toda rota do módulo está DECLARADA na matriz', () => {
  const declaradas = [...rotasDeclaradas().keys()];
  const naoPrevistas = declaradas.filter(rota => !(rota in PORTAO_ESPERADO));

  assert.deepEqual(
    naoPrevistas,
    [],
    'rota nova sem célula na matriz — declare o portão dela aqui e no api-contracts.md'
  );
});

test('nenhuma rota da matriz sumiu do router', () => {
  const declaradas = rotasDeclaradas();
  const sumidas = Object.keys(PORTAO_ESPERADO).filter(rota => !declaradas.has(rota));

  assert.deepEqual(sumidas, [], 'a matriz promete rota que o router não tem');
});

test('cada rota tem o portão que a matriz manda', () => {
  const declaradas = rotasDeclaradas();
  const divergentes = [];

  for (const [rota, esperado] of Object.entries(PORTAO_ESPERADO)) {
    const real = declaradas.get(rota);
    if (real !== esperado) divergentes.push(`${rota}: esperava ${esperado}, achei ${real}`);
  }

  assert.deepEqual(divergentes, []);
});

test('o portão dos três papéis existe e é aplicado ANTES das rotas', () => {
  // `router.use(requireComercialAccess)` no topo é o que sustenta as células
  // marcadas 'acesso'. Se ele sair, elas passam a não ter portão nenhum — e
  // este teste continuaria verde sem esta asserção.
  const posicaoDoUse = router.indexOf('router.use(requireComercialAccess)');
  const primeiraRota = router.search(/router\.(get|post|put|delete)\(/);

  assert.ok(posicaoDoUse > 0, 'requireComercialAccess não é aplicado no router');
  assert.ok(posicaoDoUse < primeiraRota, 'o portão precisa vir antes da primeira rota');
});

/* ------------------------------------------------------------------------- *
 * T110b — o único DELETE é o do anexo, e ele fecha depois de finalizada.
 * ------------------------------------------------------------------------- */

test('o ÚNICO DELETE do módulo é o do anexo', () => {
  // Reformulada em 13/08: a redação original era "não existe rota de exclusão",
  // e deixou de ser verdade com a T128. Enumerar e afirmar a única permitida é
  // mais forte — pega tanto um DELETE novo de proposta quanto a perda do portão.
  const deletes = [...router.matchAll(/router\.delete\(\s*'([^']+)'/g)].map(m => m[1]);

  assert.deepEqual(deletes, ['/propostas/:id/anexos/:anexoId']);
});

test('remover anexo de proposta FINALIZADA é recusado com 409', async () => {
  const { removerAnexo } = await import('../src/lib/comercial/anexos.js');

  const prisma = {
    proposalAttachment: {
      findUnique: async () => ({
        id: 'anexo-1',
        storagePath: 'x',
        originalName: 'art.pdf',
        proposal: { id: 'p1', createdByUserId: 'va', status: 'FINALIZADA' }
      }),
      delete: async () => {
        throw new Error('não deveria apagar');
      }
    }
  };

  // Depois de finalizada, o arquivo já foi ao CRM e ao SharePoint: apagar aqui
  // deixaria o nosso registro dizendo uma coisa e o destino, outra.
  await assert.rejects(() => removerAnexo(prisma, vendedorA, 'anexo-1'), erro => {
    assert.equal(erro.statusCode, 409);
    assert.match(erro.message, /já finalizada/i);
    return true;
  });
});

test('remover anexo de OUTRO vendedor é 403, não 409', async () => {
  const { removerAnexo } = await import('../src/lib/comercial/anexos.js');

  const prisma = {
    proposalAttachment: {
      findUnique: async () => ({
        id: 'anexo-2',
        storagePath: 'x',
        originalName: 'art.pdf',
        proposal: { id: 'p2', createdByUserId: 'vb', status: 'RASCUNHO' }
      }),
      delete: async () => {
        throw new Error('não deveria apagar');
      }
    }
  };

  // A ordem das checagens importa: autoria antes do estado. Ao contrário,
  // o vendedor B descobriria pelo código do erro que a proposta de A já foi
  // finalizada — informação sobre registro que ele não pode nem ler.
  await assert.rejects(() => removerAnexo(prisma, vendedorA, 'anexo-2'), erro => {
    assert.equal(erro.statusCode, 403);
    return true;
  });
});
