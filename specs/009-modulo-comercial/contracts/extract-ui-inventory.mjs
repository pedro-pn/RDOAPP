/**
 * Extrai o inventário de UI da referência congelada (etapa E0-6 do
 * docs/PLANO_MODULO_COMERCIAL.md).
 *
 * O inventário é o oráculo de paridade visual do porte: o `/speckit-analyze`
 * cruza os IDs daqui contra as tarefas e acusa item de UI sem cobertura. Por
 * isso a extração é feita pela AST do TypeScript, e não por regex — campo
 * perdido aqui vira campo perdido na reescrita, e ausência de campo não gera
 * erro nenhum, só some.
 *
 * Uso:
 *   node specs/009-modulo-comercial/contracts/extract-ui-inventory.mjs
 *
 * Saída: ui-inventory.raw.json (dados crus, insumo do ui-inventory.md revisado).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../frontend/node_modules/typescript",
));

const REF_DIR = process.env.COMERCIAL_REF_DIR ?? path.join(homedir(), "comercialAPP");
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

function refCommit() {
  try {
    return execFileSync("git", ["-C", REF_DIR, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "desconhecido";
  }
}

const SCREENS = [
  { id: "LOGIN", file: "app/login/page.tsx", title: "Login" },
  { id: "PROP", file: "app/page.tsx", title: "Proposta comercial" },
  { id: "CUSTO", file: "app/custos/page.tsx", title: "Levantamento de custos" },
  { id: "HIST", file: "app/historico/page.tsx", title: "Histórico de propostas" },
];

/** Elementos que carregam entrada do usuário e que o porte precisa reproduzir. */
const CONTROL_TAGS = new Set(["input", "select", "textarea", "button", "option", "form", "label"]);

/** Atributos que descrevem o comportamento visível de um controle. */
const INTERESTING_ATTRS = new Set([
  "type", "name", "id", "placeholder", "value", "min", "max", "step", "maxLength",
  "required", "disabled", "readOnly", "checked", "multiple", "accept", "rows", "cols",
  "aria-label", "aria-invalid", "aria-describedby", "role", "title", "htmlFor", "className",
]);

function attrText(attr, source) {
  if (!attr.initializer) return "true";
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  return attr.initializer.getText(source).replace(/\s+/g, " ").trim();
}

/**
 * Texto literal visível dentro de um elemento JSX, descendo por elementos
 * aninhados. Sem descer, botão com ícone ou `<span>` interno sai com rótulo
 * vazio — que foi exatamente o que aconteceu na primeira versão.
 */
function literalText(node, depth = 0) {
  if (depth > 4) return "";
  const parts = [];
  for (const child of node.children ?? []) {
    if (ts.isJsxText(child)) {
      const text = child.text.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    } else if (ts.isJsxExpression(child) && child.expression
      && ts.isStringLiteral(child.expression)) {
      parts.push(child.expression.text);
    } else if (ts.isJsxElement(child)) {
      const nested = literalText(child, depth + 1);
      if (nested) parts.push(nested);
    }
  }
  return parts.join(" ").trim();
}

const hasLetters = (value) => /\p{L}/u.test(value);

/**
 * Separa texto que o usuário lê de identificador técnico. Chave de enum,
 * className e nome de campo entram no mesmo `StringLiteral` que a mensagem de
 * erro, e sem esse filtro o inventário vira lista de ruído — impossível de
 * revisar e inútil para o `/speckit-analyze` cruzar.
 */
function isUserFacing(value) {
  const text = value.trim();
  if (text.length < 3 || !hasLetters(text)) return false;
  // camelCase, snake_case, kebab-case, dot.path: identificador, não frase.
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return false;
  if (/^[a-z0-9]+([_-][a-z0-9]+)+$/.test(text)) return false;
  if (/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(text)) return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(text)) return false;
  // Diretiva, MIME, unidade CSS, cor, URL.
  if (/^use (client|server)$/.test(text)) return false;
  if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(text)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  // PascalCase colado é nome de tipo/componente, não rótulo.
  if (/^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(text)) return false;
  // Frase de verdade: tem espaço, acento ou pontuação final.
  if (/\s/.test(text) || /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(text) || /[.?!:]$/.test(text)) {
    return true;
  }
  // Rótulo de palavra única com inicial maiúscula ("Premissas", "Resumo").
  // Sem isto o inventário perde nome de aba e de seção, que é justamente o que
  // o porte mais precisa reproduzir.
  return /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(text);
}

function extract(screen) {
  const filePath = path.join(REF_DIR, screen.file);
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const controls = [];
  const headings = [];
  const strings = new Map();

  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(source);
      const attributes = {};
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(source);
        if (INTERESTING_ATTRS.has(name)) attributes[name] = attrText(attr, source);
      }

      if (CONTROL_TAGS.has(tag) || /^[A-Z]/.test(tag)) {
        const parent = ts.isJsxOpeningElement(node) ? node.parent : node;
        const text = ts.isJsxElement(parent) ? literalText(parent) : "";
        if (CONTROL_TAGS.has(tag) || Object.keys(attributes).length > 0 || text) {
          controls.push({ tag, line: lineOf(node), text, attributes });
        }
      }

      if (/^h[1-6]$/.test(tag)) {
        const parent = node.parent;
        headings.push({
          tag,
          line: lineOf(node),
          text: ts.isJsxElement(parent) ? literalText(parent) : "",
        });
      }
    }

    // Texto que aparece direto no JSX é visível por construção.
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text && hasLetters(text) && !strings.has(text)) {
        strings.set(text, { line: lineOf(node), origin: "jsx" });
      }
    }
    // String literal do código: mensagem de erro, rótulo de option, texto de
    // confirmação. Precisa do filtro porque aqui também moram chaves de enum.
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && !ts.isImportDeclaration(node.parent)
      && !ts.isJsxAttribute(node.parent)
      && isUserFacing(node.text)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (!strings.has(text)) strings.set(text, { line: lineOf(node), origin: "codigo" });
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return {
    ...screen,
    lines: source.getLineStarts().length,
    controls,
    headings,
    strings: [...strings.entries()]
      .map(([text, meta]) => ({ text, ...meta }))
      .sort((a, b) => a.line - b.line),
  };
}

/**
 * Sinais dos comportamentos obrigatórios da alínea (c) do Princípio VI
 * (exceção de identidade portada). Não substituem a conferência manual: dizem
 * onde olhar, e principalmente onde a referência NÃO tem o comportamento — que
 * é o caso em que o porte precisa implementar em vez de copiar.
 */
function behaviourSignals(filePath) {
  const source = readFileSync(filePath, "utf8");
  const count = (pattern) => (source.match(pattern) ?? []).length;
  return {
    ariaInvalid: count(/aria-invalid/g),
    selects: count(/<select\b/g),
    dragDrop: count(/onDrag|draggable|onPointerDown|touch-action/g),
    urlState: count(/useSearchParams|pushState|replaceState|location\.hash/g),
    localStorage: count(/localStorage/g),
    dialogs: count(/<dialog\b|role="dialog"/g),
    tables: count(/<table\b/g),
  };
}

const screens = SCREENS.map((screen) => ({
  ...extract(screen),
  signals: behaviourSignals(path.join(REF_DIR, screen.file)),
}));

/** IDs estáveis: dependem só da ordem de linha da referência congelada. */
function pad(index) {
  return String(index + 1).padStart(3, "0");
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function describeControl(control) {
  const attrs = Object.entries(control.attributes)
    .filter(([key]) => key !== "className")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  return attrs || "—";
}

function renderMarkdown() {
  const out = [];
  out.push("# Inventário de UI — referência do módulo comercial");
  out.push("");
  out.push("Etapa **E0-6** do `docs/PLANO_MODULO_COMERCIAL.md`. Extraído pela AST do");
  out.push("TypeScript a partir da referência congelada, **não por regex** — campo perdido");
  out.push("aqui vira campo perdido na reescrita, e ausência de campo não gera erro nenhum:");
  out.push("só some.");
  out.push("");
  out.push("Este arquivo é o oráculo de paridade visual. O `/speckit-analyze` cruza os IDs");
  out.push("daqui contra as tarefas e acusa item sem cobertura. **Nenhum item pode ficar");
  out.push("órfão** (critério de aceite da E-1).");
  out.push("");
  out.push("## Origem e estabilidade dos IDs");
  out.push("");
  out.push("| | |");
  out.push("|---|---|");
  out.push(`| Referência | \`~/comercialAPP\`, congelada em \`${refCommit()}\` |`);
  out.push("| Extrator | `extract-ui-inventory.mjs` (AST, TypeScript 5.9) |");
  out.push("| Dados crus | `ui-inventory.raw.json` |");
  out.push("");
  out.push("Os IDs derivam da ordem de linha do arquivo de origem. **Eles só são estáveis");
  out.push("porque a referência está congelada** — foi por isso que a E0-2 veio antes desta");
  out.push("etapa. Se a referência mudar, os IDs mudam e as tarefas que os citam passam a");
  out.push("apontar para outro elemento, em silêncio.");
  out.push("");
  out.push("## Resumo");
  out.push("");
  out.push("| Tela | ID | Arquivo | Linhas | Controles | Títulos | Textos |");
  out.push("|---|---|---|---:|---:|---:|---:|");
  for (const screen of screens) {
    out.push(`| ${screen.title} | \`${screen.id}\` | \`${screen.file}\` | ${screen.lines} `
      + `| ${screen.controls.length} | ${screen.headings.length} | ${screen.strings.length} |`);
  }
  out.push("");
  const totalControls = screens.reduce((n, s) => n + s.controls.length, 0);
  const totalStrings = screens.reduce((n, s) => n + s.strings.length, 0);
  out.push(`**Total: ${totalControls} controles e ${totalStrings} textos visíveis.**`);
  out.push("");
  out.push("## Sinais de comportamento obrigatório");
  out.push("");
  out.push("Ocorrências no código da referência, para a alínea (c) do Princípio VI");
  out.push("(`aria-invalid` com mensagem visível, estados de `select`, drag and drop no");
  out.push("padrão compartilhado, navegação em URL, tutorial de primeiro acesso).");
  out.push("");
  out.push("| Tela | aria-invalid | select | drag/drop | estado em URL | localStorage | diálogo | tabela |");
  out.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const screen of screens) {
    const s = screen.signals;
    out.push(`| \`${screen.id}\` | ${s.ariaInvalid} | ${s.selects} | ${s.dragDrop} `
      + `| ${s.urlState} | ${s.localStorage} | ${s.dialogs} | ${s.tables} |`);
  }
  out.push("");
  out.push("> **Zero em uma coluna é achado, não ausência de dado.** Onde a referência não");
  out.push("> tem o comportamento, o porte precisa implementá-lo para atender a constitution");
  out.push("> — a exceção de identidade portada dispensa a paleta, nunca o comportamento.");
  out.push("> Cada zero acima vira uma linha da lista de desvios deliberados (E0-8).");
  out.push("");

  for (const screen of screens) {
    out.push(`## ${screen.id} — ${screen.title}`);
    out.push("");
    out.push(`Origem: \`${screen.file}\``);
    out.push("");

    if (screen.headings.length > 0) {
      out.push(`### ${screen.id}: títulos`);
      out.push("");
      out.push("| ID | Linha | Nível | Texto |");
      out.push("|---|---:|---|---|");
      screen.headings.forEach((item, index) => {
        out.push(`| \`${screen.id}-H-${pad(index)}\` | ${item.line} | ${item.tag} `
          + `| ${escapeCell(item.text) || "—"} |`);
      });
      out.push("");
    }

    out.push(`### ${screen.id}: controles`);
    out.push("");
    out.push("| ID | Linha | Elemento | Rótulo | Atributos |");
    out.push("|---|---:|---|---|---|");
    screen.controls.forEach((item, index) => {
      out.push(`| \`${screen.id}-CTL-${pad(index)}\` | ${item.line} | \`${item.tag}\` `
        + `| ${escapeCell(item.text) || "—"} | ${escapeCell(describeControl(item))} |`);
    });
    out.push("");

    out.push(`### ${screen.id}: textos visíveis`);
    out.push("");
    out.push("`jsx` = escrito direto na marcação. `codigo` = string do código (mensagem de");
    out.push("erro, rótulo de opção, texto de confirmação).");
    out.push("");
    out.push("| ID | Linha | Origem | Texto |");
    out.push("|---|---:|---|---|");
    screen.strings.forEach((item, index) => {
      out.push(`| \`${screen.id}-TXT-${pad(index)}\` | ${item.line} | ${item.origin} `
        + `| ${escapeCell(item.text)} |`);
    });
    out.push("");
  }

  out.push("## Revisão humana");
  out.push("");
  out.push("- [ ] Percorrer a referência de pé (E0-7) e conferir que cada tela do inventário");
  out.push("      corresponde ao que aparece na tela.");
  out.push("- [ ] Marcar os itens que são ruído de extração e não elemento de UI.");
  out.push("- [ ] Marcar os itens que o porte NÃO vai reproduzir, com motivo — eles viram a");
  out.push("      lista fechada de desvios deliberados (E0-8).");
  out.push("- [ ] Conferir os zeros da tabela de sinais contra a tela real.");
  out.push("");
  return `${out.join("\n")}\n`;
}

const summary = screens.map((screen) => ({
  id: screen.id,
  title: screen.title,
  file: screen.file,
  lines: screen.lines,
  controls: screen.controls.length,
  headings: screen.headings.length,
  strings: screen.strings.length,
}));

writeFileSync(
  path.join(OUT_DIR, "ui-inventory.raw.json"),
  `${JSON.stringify({ generatedFrom: REF_DIR, commit: refCommit(), summary, screens }, null, 2)}\n`,
);
writeFileSync(path.join(OUT_DIR, "ui-inventory.md"), renderMarkdown());

console.table(summary);
console.table(screens.map((s) => ({ tela: s.id, ...s.signals })));
console.log(`\nTotal de controles: ${screens.reduce((n, s) => n + s.controls.length, 0)}`);
console.log(`Total de strings visíveis: ${screens.reduce((n, s) => n + s.strings.length, 0)}`);
