/**
 * Semeia uma proposta e um levantamento no banco local da referência, para a
 * captura da baseline visual (E0-7).
 *
 * Por que é preciso: o caminho "Nova proposta" chama
 * `GET /api/nectar/next-number`, que exige `NECTAR_API_TOKEN` e faz chamada real
 * ao CRM Nectar — sem fallback local (`app/api/nectar/next-number/route.ts:24-30`).
 * Sem token não há como criar proposta, e sem proposta as telas ficam vazias.
 *
 * O caminho "Revisar proposta" NÃO toca o Nectar: lê `proposal_history` por
 * `base` e `cost_estimates` por `proposalCode`, ambos locais
 * (`app/custos/page.tsx:250-252`). Semeando essas duas tabelas, a revisão abre
 * as telas com dados de verdade.
 *
 * O levantamento semeado é o payload do golden 12 (precificação
 * `filtrovali_net_revenue_v1` com mão de obra, insumos e logística) — o caminho
 * de produção. Assim a baseline sai com formulário cheio, que é o que interessa
 * para conferir espaçamento, alinhamento e quebra em mobile.
 *
 * Nenhum arquivo de código da referência é alterado: só o banco local do
 * miniflare, que é descartável e está no .gitignore.
 *
 * Uso:
 *   node specs/009-modulo-comercial/contracts/semear-proposta-baseline.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const REF_DIR = process.env.COMERCIAL_REF_DIR ?? path.join(homedir(), "comercialAPP");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, "goldens/12-pricing-filtrovali-net-revenue.golden.json");
const D1_DIR = path.join(REF_DIR, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

const BASE_NUMBER = 4418;
const PROPOSAL_CODE = String(BASE_NUMBER);

function findDatabase() {
  let entries;
  try {
    entries = readdirSync(D1_DIR);
  } catch {
    throw new Error(
      `Banco local não encontrado em ${D1_DIR}.\n`
      + "Rode `pnpm dev` na referência e faça ao menos uma tentativa de login.",
    );
  }
  const files = entries.filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length === 0) throw new Error("O app ainda não criou as tabelas. Tente logar e rode de novo.");
  return path.join(D1_DIR, files[0]);
}

const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
const { payload, result } = golden;

const db = new DatabaseSync(findDatabase());
const tables = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name),
);

// As tabelas nascem na primeira chamada de cada rota. Se ainda não existem, o
// app não foi exercitado o bastante — criar na mão aqui seria duplicar o schema
// da referência e sair de sincronia com ela em silêncio.
for (const required of ["proposal_history", "cost_estimates"]) {
  if (!tables.has(required)) {
    db.close();
    throw new Error(
      `Tabela ${required} ainda não existe.\n`
      + "Abra http://localhost:3000/historico autenticado (cria proposal_history) e\n"
      + "http://localhost:3000/custos (cria cost_estimates), depois rode de novo.",
    );
  }
}

const now = new Date().toISOString();
const issueDate = now.slice(0, 10);

db.prepare("DELETE FROM proposal_history WHERE base_number = ?").run(BASE_NUMBER);
db.prepare(`INSERT INTO proposal_history (
  proposal_code, base_number, revision, mode, issue_date, client_name, company_id,
  contact_name, contact_id, contact_email, site, title, total_value, file_name,
  commercial_file_name, technical_file_name, commercial_object_key, technical_object_key,
  integration_status, estimator_name, seller_name, finalized_by_user_id,
  finalized_by_username, sharepoint_folder, opportunity_id, nectar_pipeline_id,
  nectar_pipeline_name, nectar_status, sharepoint_status, complete, error_message,
  snapshot, created_at, updated_at
) VALUES (?, ?, 0, 'new', ?, ?, '', ?, '', ?, ?, ?, ?, ?, ?, ?, '', '',
  'pending', ?, ?, '', '', '', '', '', '', 'pending', 'pending', 1, '', '{}', ?, ?)`).run(
  PROPOSAL_CODE,
  BASE_NUMBER,
  issueDate,
  "Cliente de Baseline S.A.",
  "Contato de Baseline",
  "contato@baseline.local",
  "https://baseline.local",
  payload.title,
  result.salePrice,
  `PROPOSTA-${PROPOSAL_CODE}-R0.pdf`,
  `PROPOSTA-COMERCIAL-${PROPOSAL_CODE}-R0.pdf`,
  `PROPOSTA-TECNICA-${PROPOSAL_CODE}-R0.pdf`,
  "Baseline E0",
  "Vendedor de Baseline",
  now,
  now,
);

db.prepare("DELETE FROM cost_estimates WHERE proposal_code = ?").run(PROPOSAL_CODE);
db.prepare(`INSERT INTO cost_estimates (
  id, proposal_code, title, sale_price, total_cost, net_revenue, balance, margin,
  estimator_user_id, estimator_name, created_by_user_id, updated_by_user_id,
  payload, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  "estimate-baseline-e0",
  PROPOSAL_CODE,
  payload.title,
  result.salePrice,
  result.totalCost,
  result.netRevenue,
  result.balance,
  result.margin,
  "user-baseline-e0",
  "Baseline E0",
  "user-baseline-e0",
  "user-baseline-e0",
  JSON.stringify({ ...payload, proposalCode: PROPOSAL_CODE }),
  now,
  now,
);

const proposals = db.prepare(
  "SELECT proposal_code, base_number, revision, client_name, total_value FROM proposal_history",
).all();
const estimates = db.prepare(
  "SELECT proposal_code, title, sale_price, total_cost FROM cost_estimates",
).all();
db.close();

console.log(`Proposta ${BASE_NUMBER} semeada a partir do golden 12.\n`);
console.table(proposals);
console.table(estimates);
console.log(`
Como usar:
  1. Abra http://localhost:3000/custos
  2. Escolha "Revisar proposta"
  3. Informe ${BASE_NUMBER} e confirme

O levantamento abre preenchido: mão de obra com duas alocações, volume de
tubulação, produtos químicos dosados e logística rodoviária de ida e volta.
`);
