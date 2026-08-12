/**
 * As duas correções ESTRUTURAIS dos `.docx` (tarefa T132).
 *
 * Separadas de `comercial-corrigir-modelos.mjs` porque não são troca de palavra:
 * uma remove um parágrafo, a outra reescreve células de uma tabela de preço. As
 * duas foram conferidas linha a linha e confirmadas pelo mantenedor em 12/08.
 *
 * ------------------------------------------------------------------------
 * 1. RFA duplicado — item 8 da proposta técnica
 *
 * O item 8 é uma lista onde cada entrada termina em `;` e a última em `.`. A
 * frase do RFA aparece **duas vezes**, idêntica, uma com cada pontuação. Sai a
 * do meio (`;`), e a lista volta a fechar com `.`.
 *
 * ------------------------------------------------------------------------
 * 2. Tabela de mobilização — comercial de hidrojateamento
 *
 * As linhas são **pares**: mobilização e desmobilização para cada tamanho de
 * equipe. Só o par de 3 técnicos está completo; 4 e 5 técnicos têm duas
 * desmobilizações cada, e nenhuma mobilização.
 *
 *     mobilização    de equipe 3 técnicos   ✓
 *     desmobilização de equipe 3 técnicos   ✓
 *     desmobilização de equipe 4 técnicos   <- vira mobilização
 *     desmobilização de equipe 4 técnicos   ✓
 *     desmobilização de equipe 5 técnicos   <- vira mobilização
 *     desmobilização de equipe 5 técnicos   ✓
 *
 * **A nota da E0 dizia três linhas; são duas por tabela.** Com três, ficariam
 * quatro mobilizações contra duas desmobilizações e os pares não fechariam. O
 * mantenedor confirmou a leitura antes desta correção existir.
 *
 * Vale só nos ORIGINAIS: no modelo gerado, essas linhas já viraram a
 * linha-modelo `{{descricao_a}}`, e o conteúdo vem do app.
 *
 *     node scripts/comercial-corrigir-estrutura.mjs            # prévia
 *     node scripts/comercial-corrigir-estrutura.mjs --aplicar
 */
import AdmZip from 'adm-zip';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../Modelos/definitivos/Comercial');

const aplicar = process.argv.includes('--aplicar');
const semTags = trecho => trecho.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let total = 0;

// ---------------------------------------------------------------------------
// 1. RFA duplicado
// ---------------------------------------------------------------------------

for (const relativo of ['modelos/Proposta técnica.docx', 'Proposta técnica - Preenchida.docx']) {
  const arquivo = path.join(RAIZ, relativo);
  const zip = new AdmZip(arquivo);
  const xml = zip.getEntry('word/document.xml').getData().toString('utf8');

  // O teste é sobre o TEXTO do parágrafo, não sobre o XML cru: o Word parte a
  // frase entre vários `w:t` por qualquer motivo, e procurar no XML acha zero
  // com ar de "não existe". Foi assim que a primeira versão deste script
  // reportou "nada a fazer" para dois arquivos que tinham o problema.
  const paragrafos = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)];
  const comRfa = paragrafos.filter(m => /RFA \(relatório de flushing/.test(semTags(m[0])));

  if (comRfa.length < 2) {
    console.log(`\n${relativo}: ${comRfa.length} parágrafo(s) com RFA — nada a fazer.`);
    continue;
  }

  // O que sai é o que NÃO fecha a lista: termina em `;`, não em `.`.
  const duplicado = comRfa.find(m => semTags(m[0]).endsWith(';'));
  if (!duplicado) {
    console.log(`\n${relativo}: os dois RFA terminam igual — não sei qual remover. Pulando.`);
    continue;
  }

  console.log(`\n${relativo}`);
  console.log(`  remove: ...${semTags(duplicado[0]).slice(-70)}`);
  console.log(`  mantém: ...${semTags(comRfa.find(m => m !== duplicado)[0]).slice(-70)}`);

  // Junto com ele sai o parágrafo vazio que o segue — cada entrada da lista tem
  // o seu, e deixá-lo para trás abriria uma linha em branco a mais.
  const fim = duplicado.index + duplicado[0].length;
  const seguinte = /^<w:p[ >][\s\S]*?<\/w:p>/.exec(xml.slice(fim));
  const espacador = seguinte && !semTags(seguinte[0]) ? seguinte[0].length : 0;

  if (aplicar) {
    const novo = xml.slice(0, duplicado.index) + xml.slice(fim + espacador);
    zip.updateFile('word/document.xml', Buffer.from(novo, 'utf8'));
    zip.writeZip(arquivo);
  }
  total += 1;
}

// ---------------------------------------------------------------------------
// 2. Tabela de mobilização
// ---------------------------------------------------------------------------

const arquivoTabela = path.join(RAIZ, 'Proposta comercial hidrojateamento - preenchido.docx');
const zipTabela = new AdmZip(arquivoTabela);
let xmlTabela = zipTabela.getEntry('word/document.xml').getData().toString('utf8');

console.log('\nProposta comercial hidrojateamento - preenchido.docx');

/**
 * As linhas são localizadas pelo TEXTO, e a troca acontece na PALAVRA.
 *
 * A frase se parte entre `w:t` — numa linha ela vem inteira, na outra o Word
 * cortou em "equipe| 4 técnicos". Mas **"desmobilização" está intacta** nas
 * duas, então trocar a palavra funciona onde trocar a frase falharia.
 */
for (const tamanho of ['4', '5']) {
  const linhas = [...xmlTabela.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].filter(m =>
    semTags(m[0]).includes(`desmobilização de equipe ${tamanho} técnicos`)
  );

  if (linhas.length !== 4) {
    // Duas tabelas (ONSHORE e OFFSHORE), duas linhas cada.
    console.log(`  equipe ${tamanho}: ${linhas.length} linha(s), esperava 4 — não mexo.`);
    continue;
  }

  // A PRIMEIRA de cada par vira mobilização; a segunda fica. De trás para a
  // frente, para os índices ainda não usados continuarem válidos.
  for (const linha of [linhas[2], linhas[0]]) {
    const posicao = linha.index + linha[0].indexOf('desmobilização');
    xmlTabela =
      xmlTabela.slice(0, posicao) + 'mobilização' + xmlTabela.slice(posicao + 'desmobilização'.length);
    total += 1;
  }

  console.log(`  equipe ${tamanho}: 2 linhas viram "mobilização" (uma por tabela)`);
}

if (aplicar) {
  zipTabela.updateFile('word/document.xml', Buffer.from(xmlTabela, 'utf8'));
  zipTabela.writeZip(arquivoTabela);
}

console.log(
  aplicar
    ? `\n${total} correção(ões) aplicada(s).`
    : `\n${total} correção(ões) encontradas. Rode com --aplicar para gravar.`
);
