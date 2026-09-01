import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ComercialError,
  CostEstimateValidationError,
  computeTotals,
  createCostEstimate,
  getCostEstimate,
  listCostEstimates,
  payloadHash,
  toFieldIssues,
  updateCostEstimate,
} from "../src/lib/comercial/cost-estimates.js";

/**
 * Levantamentos de custos — camada de negócio (tarefas T031 a T036).
 *
 * Usa um Prisma falso de propósito: o que precisa ser provado aqui é regra,
 * não SQL. As três coisas que importam:
 *
 *   1. os totais são os do SERVIDOR, não os do cliente
 *   2. a listagem filtra por autoria
 *   3. o erro sai item a item, com o endereço do campo
 */

const here = dirname(fileURLToPath(import.meta.url));
const goldensDir = join(
  here,
  "../../specs/009-modulo-comercial/contracts/goldens",
);

function carregarGolden(nome) {
  return JSON.parse(
    readFileSync(join(goldensDir, `${nome}.golden.json`), "utf8"),
  );
}

const gestor = { id: "u-gestor", moduleRoles: ["comercial:manager"] };
const vendedorA = { id: "u-vend-a", moduleRoles: ["comercial:seller"] };
const vendedorB = { id: "u-vend-b", moduleRoles: ["comercial:seller"] };

/** Prisma falso: guarda o que foi gravado para o teste inspecionar. */
function fakePrisma(seed = []) {
  const store = { estimates: [...seed], versions: [] };

  const tx = {
    costEstimate: {
      create: async ({ data }) => {
        const row = {
          id: `e${store.estimates.length + 1}`,
          archivedAt: null,
          ...data,
        };
        store.estimates.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = store.estimates.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    costEstimateVersion: {
      create: async ({ data }) => {
        store.versions.push(data);
        return data;
      },
      findFirst: async ({ where }) => {
        const versions = store.versions.filter(
          (v) => v.costEstimateId === where.costEstimateId,
        );
        return versions[versions.length - 1] || null;
      },
    },
  };

  return {
    store,
    ...tx,
    costEstimate: {
      ...tx.costEstimate,
      findUnique: async ({ where }) =>
        store.estimates.find((item) => item.id === where.id) || null,
      count: async ({ where }) =>
        store.estimates.filter((item) => {
          if (
            where.createdByUserId &&
            item.createdByUserId !== where.createdByUserId
          )
            return false;
          if (where.archivedAt === null && item.archivedAt !== null)
            return false;
          if (where.archivedAt?.not === null && item.archivedAt === null)
            return false;
          if (where.status && item.status !== where.status) return false;
          return true;
        }).length,
      findMany: async ({ where, skip = 0, take }) =>
        store.estimates
          .filter((item) => {
            if (
              where.createdByUserId &&
              item.createdByUserId !== where.createdByUserId
            )
              return false;
            if (where.archivedAt === null && item.archivedAt !== null)
              return false;
            if (where.archivedAt?.not === null && item.archivedAt === null)
              return false;
            if (where.status && item.status !== where.status) return false;
            return true;
          })
          .slice(skip, take === undefined ? undefined : skip + take),
    },
    $transaction: async (fn) => fn(tx),
  };
}

// ---------------------------------------------------------------------------
// Totais vêm do servidor
// ---------------------------------------------------------------------------

test("os totais são recalculados no servidor e batem com o golden", () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const { totalCost, salePrice } = computeTotals(golden.payload);

  assert.equal(totalCost, Number(golden.result.totalCost));
  assert.equal(salePrice, Number(golden.result.salePrice));
});

test("a margem é gravada em percentual, não em fração", () => {
  // O motor devolve 0,15; o banco guarda Decimal(6,2) como 15,00. Trocar os
  // dois produz margem cem vezes menor sem nenhum erro visível.
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const { marginPercent } = computeTotals(golden.payload);

  assert.ok(marginPercent > 1, "a margem foi gravada como fração");
  assert.equal(marginPercent, Number(golden.result.margin) * 100);
});

test("totais enviados pelo cliente são IGNORADOS", async () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma();

  await createCostEstimate(prisma, vendedorA, {
    proposalCode: "4418",
    title: "Levantamento",
    mode: "NOVA",
    payload: golden.payload,
    // Um cliente malicioso mandando margem inflada:
    totalCost: 1,
    salePrice: 999999,
    marginPercent: 99,
  });

  const gravado = prisma.store.estimates[0];
  assert.equal(gravado.salePrice, Number(golden.result.salePrice));
  assert.notEqual(gravado.salePrice, 999999, "margem forjada entrou no banco");
});

// ---------------------------------------------------------------------------
// Erro item a item, com endereço de campo
// ---------------------------------------------------------------------------

test("o cenário 01 devolve as 12 pendências separadas, não um texto só", () => {
  const golden = carregarGolden("01-default-intocado");
  const issues = toFieldIssues(golden.validation);

  assert.equal(issues.length, 12, "o golden 01 tem 12 erros");
  for (const issue of issues) {
    assert.ok("path" in issue, "toda pendência precisa do campo path");
    assert.ok(issue.message, "toda pendência precisa de mensagem");
    assert.ok(["error", "warning"].includes(issue.severity));
  }
});

test("o path é um endereço de campo de verdade — é o que sustenta a L1", () => {
  // A lacuna L1 inteira depende disto: `validateCostEstimate` já sabe QUAL
  // campo está pendente (`laborContexts[0].workCondition`), e a referência
  // joga essa informação fora ao concatenar tudo numa string. Se um dia esta
  // asserção quebrar, a L1 deixa de ser "ligar o que já existe" e vira
  // trabalho de descobrir o endereço do zero.
  const golden = carregarGolden("01-default-intocado");
  const issues = toFieldIssues(golden.validation);

  const comEndereco = issues.filter(
    (issue) => typeof issue.path === "string" && issue.path,
  );
  assert.equal(
    comEndereco.length,
    issues.length,
    "toda pendência do cenário 01 tem de trazer o endereço do campo",
  );

  assert.ok(
    issues.some((issue) => /laborContexts\[\d+\]\./.test(issue.path)),
    "o endereço precisa alcançar item de coleção, não só campo de topo",
  );
});

test("salvar levantamento inválido levanta erro 422 com as pendências", async () => {
  const golden = carregarGolden("01-default-intocado");
  const prisma = fakePrisma();

  await assert.rejects(
    () =>
      createCostEstimate(prisma, vendedorA, {
        proposalCode: "4418",
        title: "Inválido",
        mode: "NOVA",
        payload: golden.payload,
      }),
    (error) => {
      assert.ok(error instanceof CostEstimateValidationError);
      assert.equal(error.statusCode, 422);
      assert.equal(error.issues.length, 12);
      return true;
    },
  );

  assert.equal(
    prisma.store.estimates.length,
    0,
    "não pode gravar levantamento inválido",
  );
});

test("rascunho incompleto é persistido pela conta e só valida ao virar SALVO", async () => {
  const goldenIncompleto = carregarGolden("01-default-intocado");
  const prisma = fakePrisma();

  const rascunho = await createCostEstimate(prisma, vendedorA, {
    proposalCode: "4418",
    title: "Rascunho",
    mode: "NOVA",
    status: "RASCUNHO",
    payload: goldenIncompleto.payload,
  });

  assert.equal(rascunho.status, "RASCUNHO");
  assert.equal(rascunho.createdByUserId, vendedorA.id);
  assert.equal(
    prisma.store.versions.length,
    0,
    "rascunho mutável não cria versão final",
  );

  await assert.rejects(
    () =>
      updateCostEstimate(prisma, vendedorA, rascunho.id, {
        status: "SALVO",
        payload: goldenIncompleto.payload,
      }),
    (error) =>
      error instanceof CostEstimateValidationError && error.statusCode === 422,
  );
});

test("rascunho válido é promovido para SALVO e ganha versão imutável", async () => {
  const incompleto = carregarGolden("01-default-intocado");
  const completo = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma();

  const rascunho = await createCostEstimate(prisma, vendedorA, {
    proposalCode: "4418",
    title: "Rascunho",
    mode: "NOVA",
    status: "RASCUNHO",
    payload: incompleto.payload,
  });
  const salvo = await updateCostEstimate(prisma, vendedorA, rascunho.id, {
    status: "SALVO",
    payload: completo.payload,
  });

  assert.equal(salvo.status, "SALVO");
  assert.equal(prisma.store.versions.length, 1);
});

// ---------------------------------------------------------------------------
// Autoria — o caso crítico é a LISTAGEM
// ---------------------------------------------------------------------------

test("a listagem do vendedor A não traz levantamento do vendedor B", async () => {
  const prisma = fakePrisma([
    { id: "e1", createdByUserId: "u-vend-a", archivedAt: null },
    { id: "e2", createdByUserId: "u-vend-b", archivedAt: null },
  ]);

  const { items } = await listCostEstimates(prisma, vendedorA);
  assert.deepEqual(
    items.map((i) => i.id),
    ["e1"],
    "a listagem vazou registro de outro vendedor",
  );

  const doGestor = await listCostEstimates(prisma, gestor);
  assert.equal(doGestor.items.length, 2, "o gestor alcança os dois");
});

test("a listagem de levantamentos pagina, filtra elegíveis e devolve o total real", async () => {
  const prisma = fakePrisma([
    {
      id: "e1",
      createdByUserId: "u-vend-a",
      archivedAt: null,
      status: "SALVO",
    },
    {
      id: "e2",
      createdByUserId: "u-vend-a",
      archivedAt: null,
      status: "RASCUNHO",
    },
    {
      id: "e3",
      createdByUserId: "u-vend-a",
      archivedAt: null,
      status: "SALVO",
    },
    {
      id: "e4",
      createdByUserId: "u-vend-a",
      archivedAt: null,
      status: "SALVO",
    },
  ]);

  const resposta = await listCostEstimates(prisma, vendedorA, {
    status: "SALVO",
    page: 2,
    pageSize: 2,
  });
  assert.equal(resposta.total, 3);
  assert.deepEqual(
    resposta.items.map((item) => item.id),
    ["e4"],
  );
});

test("vendedor pedindo levantamento de outro autor recebe 403, não 404", async () => {
  const prisma = fakePrisma([
    { id: "e2", createdByUserId: "u-vend-b", archivedAt: null },
  ]);

  await assert.rejects(
    () => getCostEstimate(prisma, vendedorA, "e2"),
    (error) => {
      // 404 mentiria sobre a existência do registro.
      assert.equal(error.statusCode, 403);
      return true;
    },
  );

  const doDono = await getCostEstimate(prisma, vendedorB, "e2");
  assert.equal(doDono.id, "e2");
});

test("levantamento inexistente é 404", async () => {
  const prisma = fakePrisma();
  await assert.rejects(
    () => getCostEstimate(prisma, gestor, "nao-existe"),
    (error) => error instanceof ComercialError && error.statusCode === 404,
  );
});

test("vendedor não escreve em levantamento de outro autor", async () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma([
    {
      id: "e2",
      createdByUserId: "u-vend-b",
      archivedAt: null,
      payload: golden.payload,
      title: "X",
    },
  ]);

  await assert.rejects(
    () =>
      updateCostEstimate(prisma, vendedorA, "e2", { payload: golden.payload }),
    (error) => error.statusCode === 403,
  );
});

// ---------------------------------------------------------------------------
// Versionamento
// ---------------------------------------------------------------------------

test("criar levantamento grava a primeira versão com hash", async () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma();

  await createCostEstimate(prisma, vendedorA, {
    proposalCode: "4418",
    title: "Levantamento",
    mode: "NOVA",
    payload: golden.payload,
  });

  assert.equal(prisma.store.versions.length, 1);
  assert.match(prisma.store.versions[0].payloadHash, /^[a-f0-9]{64}$/);
});

test("salvar sem mudar o conteúdo NÃO cria versão nova", async () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma();

  await createCostEstimate(prisma, vendedorA, {
    proposalCode: "4418",
    title: "Levantamento",
    mode: "NOVA",
    payload: golden.payload,
  });
  const id = prisma.store.estimates[0].id;

  await updateCostEstimate(prisma, vendedorA, id, { payload: golden.payload });

  // Uma versão por salvamento encheria a tabela de cópias idênticas e tiraria
  // o sentido do hash.
  assert.equal(
    prisma.store.versions.length,
    1,
    "gravou versão sem mudança de conteúdo",
  );
});

test("o hash do payload é estável e sensível a mudança", () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const a = payloadHash(golden.payload);
  const b = payloadHash(golden.payload);
  const c = payloadHash({ ...golden.payload, title: "outro" });

  assert.equal(a, b, "o hash tem de ser estável");
  assert.notEqual(a, c, "o hash tem de mudar quando o conteúdo muda");
});

// ---------------------------------------------------------------------------
// Arquivamento
// ---------------------------------------------------------------------------

test("a listagem padrão esconde arquivados, e o filtro explícito os traz", async () => {
  const prisma = fakePrisma([
    { id: "e1", createdByUserId: "u-vend-a", archivedAt: null },
    { id: "e2", createdByUserId: "u-vend-a", archivedAt: new Date() },
  ]);

  const ativos = await listCostEstimates(prisma, vendedorA);
  assert.deepEqual(
    ativos.items.map((i) => i.id),
    ["e1"],
  );

  const arquivados = await listCostEstimates(prisma, vendedorA, {
    arquivados: true,
  });
  assert.deepEqual(
    arquivados.items.map((i) => i.id),
    ["e2"],
  );
});

test("levantamento arquivado não aceita edição", async () => {
  const golden = carregarGolden("02-sede-sem-hora-extra");
  const prisma = fakePrisma([
    {
      id: "e1",
      createdByUserId: "u-vend-a",
      archivedAt: new Date(),
      payload: golden.payload,
      title: "X",
    },
  ]);

  await assert.rejects(
    () =>
      updateCostEstimate(prisma, vendedorA, "e1", { payload: golden.payload }),
    (error) => error.statusCode === 409,
  );
});
