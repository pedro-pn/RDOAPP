/**
 * Item 8 dos `.docx`: tira os relatórios que não existem e corrige a sigla do
 * flushing com água.
 *
 * **Decidido pelo mantenedor em 13/08/2026**, depois de a planilha de serviços
 * novos revelar a divergência:
 *
 * - `RH (relatório de hidrojateamento)` — **não existe**. Sai.
 * - `RTPP (relatório de passagem de PIG)` — **não existe**. Sai.
 * - `RFA (relatório de flushing com água)` → `RLF (relatório de flushing)`,
 *   que é o relatório que o filtroAPP realmente emite (`ReportType.RLF`,
 *   `Modelos/definitivos/Modelo - RLF.docx`).
 *
 * **Mexe nos dois lados**: nos `modelos/` que o gerador usa **e** nos `.docx`
 * de origem que o comercial entregou. Corrigir só o `modelos/` faria a próxima
 * rodada de `comercial-gerar-modelos.mjs` trazer os parágrafos de volta — e
 * ninguém desconfiaria, porque o documento continuaria bonito.
 *
 * A armadilha de sempre (T132): o Word parte o texto entre vários `<w:t>`, e
 * `RFA` pode estar em três nós. Por isso a detecção é feita no texto **sem
 * tags**, e a troca de sigla é feita nó a nó.
 *
 *     node scripts/comercial-corrigir-relatorios.mjs          # mostra o que faria
 *     node scripts/comercial-corrigir-relatorios.mjs --aplicar
 */
import AdmZip from 'adm-zip';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../../', import.meta.url).pathname;
const PASTAS = [
  'Modelos/definitivos/Comercial',
  'Modelos/definitivos/Comercial/modelos'
];

const aplicar = process.argv.includes('--aplicar');

/** Parágrafos a remover, reconhecidos pelo texto sem tags. */
const REMOVER = [
  { rotulo: 'RH — relatório de hidrojateamento', teste: /RH \(relatório de hidrojateamento\)/i },
  { rotulo: 'RTPP — relatório de passagem de PIG', teste: /RTPP \(relatório de passagem de PIG\)/i },
  // Terceiro do mesmo lote, confirmado pelo mantenedor em 13/08: também não existe.
  // A planilha de serviços novos já tinha respondido "nenhum" para a boroscopia.
  { rotulo: 'RIB — relatório de inspeção por boroscopia', teste: /RIB \(relatório de inspeção por boroscopia\)/i }
];

const semTags = xml => xml.replace(/<[^>]+>/g, '');

function corrigir(xml) {
  const mudancas = [];

  // 1. Remover os parágrafos inteiros dos relatórios que não existem.
  for (const { rotulo, teste } of REMOVER) {
    const paragrafos = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].filter(m => teste.test(semTags(m[0])));
    if (!paragrafos.length) continue;
    // De trás para a frente: remover pela frente desloca os índices seguintes.
    for (const p of paragrafos.reverse()) {
      xml = xml.slice(0, p.index) + xml.slice(p.index + p[0].length);
    }
    mudancas.push(`removido ${paragrafos.length}× — ${rotulo}`);
  }

  // 2. A sigla: RFA → RLF. Cabe num nó só, então troca direta serve.
  const antesDaSigla = xml;
  xml = xml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (todo, atributos, texto) =>
    texto.includes('RFA') ? `<w:t${atributos}>${texto.replace(/RFA/g, 'RLF')}</w:t>` : todo
  );
  if (xml !== antesDaSigla) mudancas.push('RFA → RLF');

  // 3. O nome entre parênteses. Trocar só a sigla deixaria "RLF (relatório de
  //    flushing com água)", que **não é o nome do RLF** — o relatório que o
  //    filtroAPP emite se chama "Relatório de Flushing", e é o nome que o
  //    comercial escreveu na planilha.
  //
  //    Aqui a troca direta NÃO serve, e a primeira versão deste script errou
  //    por isso: o Word parte a frase em `(relatório ` + `de flushing com água`,
  //    então o regex sobre a frase inteira não acha nada — e não acha **em
  //    silêncio**. A remoção abaixo trabalha sobre o texto concatenado do
  //    parágrafo e devolve o corte para os nós certos.
  const paragrafosDoNome = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .filter(m => /RLF \(relatório de flushing com água\)/i.test(semTags(m[0])));

  for (const paragrafo of paragrafosDoNome.reverse()) {
    const corrigido = removerTrecho(paragrafo[0], /(relatório de flushing)( com água)/i, 2);
    if (corrigido === paragrafo[0]) continue;
    xml = xml.slice(0, paragrafo.index) + corrigido + xml.slice(paragrafo.index + paragrafo[0].length);
    mudancas.push('"relatório de flushing com água" → "relatório de flushing"');
  }

  return { xml, mudancas };
}

/**
 * Remove do parágrafo o grupo `grupo` do padrão, achado no texto **concatenado**
 * e apagado nos `<w:t>` que o contêm — mesmo que ele atravesse vários.
 *
 * Existe porque procurar a frase no XML cru não acha nada quando o Word a
 * partiu, e porque reescrever o parágrafo inteiro jogaria fora a formatação de
 * cada run.
 */
function removerTrecho(paragrafo, padrao, grupo) {
  const nos = [...paragrafo.matchAll(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g)];
  const texto = nos.map(n => n[2]).join('');
  const achado = padrao.exec(texto);
  if (!achado) return paragrafo;

  // Onde o grupo começa e termina dentro do texto concatenado.
  const inicio = achado.index + achado[0].indexOf(achado[grupo]);
  const fim = inicio + achado[grupo].length;

  let cursor = 0;
  let saida = '';
  let ultimo = 0;
  for (const no of nos) {
    const conteudo = no[2];
    const de = cursor;
    const ate = cursor + conteudo.length;
    cursor = ate;
    if (ate <= inicio || de >= fim) continue;

    const recortado = conteudo.slice(0, Math.max(0, inicio - de)) + conteudo.slice(Math.max(0, Math.min(conteudo.length, fim - de)));
    saida += paragrafo.slice(ultimo, no.index) + no[1] + recortado + no[3];
    ultimo = no.index + no[0].length;
  }
  return saida + paragrafo.slice(ultimo);
}

let total = 0;

for (const pasta of PASTAS) {
  const dir = join(RAIZ, pasta);
  for (const nome of readdirSync(dir).filter(n => n.endsWith('.docx') && !n.startsWith('~$'))) {
    const caminho = join(dir, nome);
    const zip = new AdmZip(caminho);
    const entrada = zip.getEntry('word/document.xml');
    if (!entrada) continue;

    const original = entrada.getData().toString('utf8');
    const { xml, mudancas } = corrigir(original);
    if (!mudancas.length) continue;

    console.log(`\n${relative(RAIZ, caminho)}`);
    for (const m of mudancas) console.log(`  - ${m}`);
    total += mudancas.length;

    if (aplicar) {
      zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
      zip.writeZip(caminho);
      console.log('  ✔ gravado');
    }
  }
}

if (!total) console.log('Nada a corrigir — os documentos já estão como o mantenedor decidiu.');
else if (!aplicar) console.log(`\n${total} mudança(s). Rode com --aplicar para gravar.`);
