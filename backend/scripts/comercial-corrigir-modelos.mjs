/**
 * Corrige os erros de digitação dos `.docx` e unifica PPRA → PGR (tarefa T132).
 *
 * Autorizado pelo mantenedor em 12/08. A lista veio de
 * `specs/009-modulo-comercial/contracts/modelos-word.md`, onde foi registrada
 * durante a E0 e **não corrigida por conta própria** — é texto que vai ao
 * cliente.
 *
 * **Mexe nos MODELOS e nos ORIGINAIS.** Os modelos são o que o app preenche; os
 * originais ("- Preenchida", "- preenchido", "- Modelo") são a fonte de onde
 * `comercial-gerar-modelos.mjs` os produz. Corrigir só os modelos faria o erro
 * voltar na próxima vez que alguém rodasse o gerador.
 *
 * Conferido antes de escrever: **as cinco palavras estão contíguas no XML**,
 * nenhuma partida entre `w:t`. Fosse o contrário, um `replace` não acharia nada
 * e o script diria "0 correções" com ar de sucesso.
 *
 *     node scripts/comercial-corrigir-modelos.mjs          # mostra o que faria
 *     node scripts/comercial-corrigir-modelos.mjs --aplicar
 */
import AdmZip from 'adm-zip';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../Modelos/definitivos/Comercial');

const CORRECOES = [
  { de: 'rezina', para: 'resina', motivo: 'grafia' },
  { de: 'Descarregametno', para: 'Descarregamento', motivo: 'letras trocadas' },
  { de: 'Instaçãoes', para: 'Instalações', motivo: 'grafia' },
  { de: 'hidrojatemento', para: 'hidrojateamento', motivo: 'grafia' },
  {
    de: 'PPRA',
    para: 'PGR',
    motivo: 'o PPRA foi substituído pelo PGR na revisão da NR-1 — citar PPRA hoje é citar programa que não existe mais'
  }
];

const PARTES = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml'
];

const aplicar = process.argv.includes('--aplicar');

function varrer(dir, encontrados = []) {
  for (const item of readdirSync(dir)) {
    const caminho = path.join(dir, item);
    if (statSync(caminho).isDirectory()) varrer(caminho, encontrados);
    else if (item.endsWith('.docx') && !item.startsWith('~$')) encontrados.push(caminho);
  }
  return encontrados;
}

/** O trecho em volta, para quem revisa ver o que muda. */
function contexto(xml, termo) {
  const i = xml.indexOf(termo);
  if (i < 0) return '';
  return xml
    .slice(Math.max(0, i - 260), i + 200)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let total = 0;

for (const arquivo of varrer(RAIZ)) {
  const zip = new AdmZip(arquivo);
  let mexeu = false;

  for (const parte of PARTES) {
    const entrada = zip.getEntry(parte);
    if (!entrada) continue;

    let xml = entrada.getData().toString('utf8');
    const antes = xml;

    for (const { de, para, motivo } of CORRECOES) {
      if (!xml.includes(de)) continue;

      const quantas = (xml.match(new RegExp(de, 'g')) || []).length;
      console.log(`\n${path.basename(arquivo)} · ${parte.replace('word/', '')}`);
      console.log(`  ${de} -> ${para}  (${quantas}x) — ${motivo}`);
      console.log(`  ...${contexto(xml, de)}...`);

      xml = xml.split(de).join(para);
      total += quantas;
    }

    if (xml !== antes) {
      mexeu = true;
      if (aplicar) zip.updateFile(parte, Buffer.from(xml, 'utf8'));
    }
  }

  if (mexeu && aplicar) zip.writeZip(arquivo);
}

console.log(
  total === 0
    ? '\nNada a corrigir.'
    : aplicar
      ? `\n${total} correção(ões) aplicada(s).`
      : `\n${total} correção(ões) encontradas. Rode com --aplicar para gravar.`
);
