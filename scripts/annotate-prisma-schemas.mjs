#!/usr/bin/env node
/**
 * Anota `@@schema("public")` em todo model e enum de backend/prisma/schema.prisma
 * que ainda não tenha anotação — tarefa T016 do módulo Comercial.
 *
 * Por que existe: ativar `multiSchema` obriga a anotar TODOS os models e enums,
 * e são ~120 blocos. Fazer isso à mão introduz erro silencioso — um bloco
 * esquecido só aparece no `prisma validate`, e um bloco anotado com o schema
 * errado só aparece em produção.
 *
 * O que este script NÃO faz: mover dados. As tabelas já estão em `public`; a
 * anotação apenas informa ao Prisma onde elas já estão. O critério de aceite é
 * o SQL da migration conter só `CREATE SCHEMA` e `CREATE TABLE comercial.*`,
 * e NENHUM `ALTER` nas tabelas da operação.
 *
 * Uso:
 *   node scripts/annotate-prisma-schemas.mjs [--check]
 *
 *   --check  não escreve; sai com código 1 se houver bloco sem anotação
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(repoRoot, 'backend/prisma/schema.prisma');

const DEFAULT_SCHEMA = 'public';
const BLOCK_START = /^(model|enum)\s+([A-Za-z0-9_]+)\s*\{/;

export function annotate(source, { schema = DEFAULT_SCHEMA } = {}) {
  const lines = source.split('\n');
  const out = [];
  const annotated = [];
  const skipped = [];

  let block = null; // { kind, name, startIndex, hasSchema, bodyDepth }
  let depth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!block) {
      const match = BLOCK_START.exec(line);
      if (match) {
        block = { kind: match[1], name: match[2], hasSchema: false };
        depth = 1;
        out.push(line);
        continue;
      }
      out.push(line);
      continue;
    }

    // Dentro de um bloco.
    if (/@@schema\s*\(/.test(line)) block.hasSchema = true;

    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;

    if (depth === 0) {
      // `line` é o fecha-chaves do bloco.
      if (block.hasSchema) {
        skipped.push(block.name);
      } else {
        const previous = out[out.length - 1];
        // Linha em branco antes da anotação só se o bloco não terminar vazio.
        if (previous !== undefined && previous.trim() !== '') out.push('');
        out.push(`  @@schema("${schema}")`);
        annotated.push(`${block.kind} ${block.name}`);
      }
      out.push(line);
      block = null;
      continue;
    }

    out.push(line);
  }

  if (block) {
    throw new Error(`Bloco não fechado no schema: ${block.kind} ${block.name}`);
  }

  return { source: out.join('\n'), annotated, skipped };
}

function main() {
  const check = process.argv.includes('--check');
  const original = readFileSync(schemaPath, 'utf8');
  const { source, annotated, skipped } = annotate(original);

  if (check) {
    if (annotated.length) {
      console.error(`${annotated.length} bloco(s) sem @@schema:`);
      for (const name of annotated) console.error(`  - ${name}`);
      process.exit(1);
    }
    console.log(`Todos os ${skipped.length} blocos têm @@schema.`);
    return;
  }

  if (!annotated.length) {
    console.log(`Nada a fazer: os ${skipped.length} blocos já têm @@schema.`);
    return;
  }

  writeFileSync(schemaPath, source);
  console.log(`Anotados ${annotated.length} bloco(s) com @@schema("${DEFAULT_SCHEMA}").`);
  console.log(`Preservados ${skipped.length} bloco(s) que já tinham anotação.`);
}

if (process.argv[1] && process.argv[1].endsWith('annotate-prisma-schemas.mjs')) {
  main();
}
