/**
 * Cria um usuário local na referência congelada, só para a captura da baseline
 * visual (etapa E0-7 do docs/PLANO_MODULO_COMERCIAL.md).
 *
 * Por que é preciso: `db/auth.ts` semeia os usuários `Aliander` e `Erike` com
 * hashes PBKDF2 fixos e os **reescreve a cada boot** (db/auth.ts:112-118), então
 * não adianta trocar a senha deles no banco. Só entra quem sabe a senha real.
 *
 * A saída é um terceiro usuário, que o seed não toca — assim a referência
 * continua congelada: nenhum arquivo de código dela é alterado, só o banco
 * local do miniflare, que já é descartável e está no .gitignore.
 *
 * O hash é gerado pela própria `hashPassword` da referência, então usa
 * exatamente o mesmo algoritmo, iterações e formato que o app espera.
 *
 * Uso (com o `pnpm dev` já tendo rodado ao menos uma vez, para o banco existir):
 *   node specs/009-modulo-comercial/contracts/criar-usuario-baseline.mjs [senha]
 */

import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REF_DIR = process.env.COMERCIAL_REF_DIR ?? path.join(homedir(), "comercialAPP");
const PASSWORD = process.argv[2] ?? "baseline-e0";
const USERNAME = "baseline";

const D1_DIR = path.join(REF_DIR, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

const { hashPassword } = await import(path.join(REF_DIR, "lib", "auth-crypto.ts"));

function findDatabase() {
  let candidates;
  try {
    candidates = readdirSync(D1_DIR);
  } catch {
    throw new Error(
      `Banco local não encontrado em ${D1_DIR}.\n`
      + "Rode `pnpm dev` na referência e faça ao menos uma tentativa de login "
      + "para o app criar as tabelas.",
    );
  }
  const files = candidates.filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length === 0) {
    throw new Error(
      "Só existe metadata.sqlite: o app ainda não criou as tabelas.\n"
      + "Faça uma tentativa de login (mesmo com senha errada) e rode de novo.",
    );
  }
  return path.join(D1_DIR, files[0]);
}

const dbPath = findDatabase();
const db = new DatabaseSync(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
if (!tables.some((item) => item.name === "app_users")) {
  db.close();
  throw new Error("Tabela app_users ausente. Faça uma tentativa de login e rode de novo.");
}

const passwordHash = await hashPassword(PASSWORD);
const now = new Date().toISOString();

db.prepare("DELETE FROM app_users WHERE username_normalized = ?").run(USERNAME);
db.prepare(`INSERT INTO app_users (
  id, username, username_normalized, display_name, estimator_name, password_hash,
  role, active, must_change_password, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, 'estimator', 1, 0, ?, ?)`).run(
  "user-baseline-e0",
  USERNAME,
  USERNAME,
  "Baseline E0",
  "Baseline E0",
  passwordHash,
  now,
  now,
);

const check = db.prepare(
  "SELECT username, display_name, active FROM app_users ORDER BY username",
).all();
db.close();

console.log(`Banco: ${dbPath}`);
console.log(`\nUsuário criado — usuário "${USERNAME}", senha "${PASSWORD}".`);
console.log("Local, descartável, só para a captura da baseline. Não vai para produção.\n");
console.table(check);
