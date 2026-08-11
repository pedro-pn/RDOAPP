import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SHAREPOINT_MODE = 'fake';
process.env.SHAREPOINT_BASE_FOLDER = 'ZZ - Testes';

const {
  caminhoDeUrl,
  gravarArquivos,
  indisponivel,
  nomeDeArquivo,
  nomeDeePasta
} = await import('../src/lib/comercial/sharepoint.js');

/**
 * Adaptador do SharePoint (T076 e T076f).
 *
 * Roda em `fake`: o destino real é a biblioteca de documentos da empresa, e não
 * existe cópia de teste dela. O que dá para provar sem rede é o que mais custa
 * quando erra — **os nomes de pasta e arquivo**, que o SharePoint recusa depois
 * do upload começar, com mensagem que não diz qual caractere ofendeu.
 */

test('nome de pasta perde o que o SharePoint recusa', () => {
  assert.equal(nomeDeePasta('4418 - Petrobras'), '4418 - Petrobras');
  // \ : * ? " < > | são recusados pelo SharePoint.
  assert.equal(nomeDeePasta('Cotação: 2026?'), 'Cotação- 2026-');
  assert.equal(nomeDeePasta('Proposta "final"'), 'Proposta -final-');
  // Nome terminado em ponto também é recusado.
  assert.equal(nomeDeePasta('Obra Macaé...'), 'Obra Macaé');
  // Espaço repetido vira um só.
  assert.equal(nomeDeePasta('4418    Petrobras'), '4418 Petrobras');
});

test('a barra continua separando níveis, e segmento vazio some', () => {
  assert.equal(nomeDeePasta('2026/08/4418'), '2026/08/4418');
  assert.equal(nomeDeePasta('//2026//4418//'), '2026/4418');
});

test('nome vazio não vira pasta sem nome', () => {
  assert.equal(nomeDeePasta(''), 'Proposta');
  assert.equal(nomeDeePasta('...'), 'Proposta');
  assert.equal(nomeDeePasta(null), 'Proposta');
});

test('nome de ARQUIVO não pode conter barra — ela criaria pasta', () => {
  // "Proposta Comercial - 4418/2.pdf" viraria a pasta "Proposta Comercial - 4418"
  // com o arquivo "2.pdf" dentro, em silêncio.
  assert.equal(nomeDeArquivo('Proposta 4418/2.pdf'), 'Proposta 4418-2.pdf');
  assert.equal(nomeDeArquivo(''), 'arquivo');
});

test('o caminho do site preserva as barras ao virar URL', () => {
  // `encodeURIComponent` no caminho inteiro comeria as barras, e o Graph não
  // acharia o site — com erro que fala de site inexistente, não de codificação.
  assert.equal(caminhoDeUrl('/sites/ArquivosFiltrovali'), ':/sites/ArquivosFiltrovali:');
  assert.equal(caminhoDeUrl('sites/Arquivos Filtrovali'), ':/sites/Arquivos%20Filtrovali:');
  assert.equal(caminhoDeUrl(''), ':');
});

test('tudo é gravado DENTRO da pasta base', () => {
  // É a contenção que não depende da Microsoft: apontar o ambiente de teste
  // para outra pasta mantém o erro de código longe de onde o comercial trabalha.
  return gravarArquivos([{ fileName: 'a.pdf', bytes: Buffer.from('x') }], {
    nomeDaPasta: '4418 - Petrobras'
  }).then(({ pasta }) => {
    assert.equal(pasta, 'ZZ - Testes/4418 - Petrobras');
  });
});

test('a pasta existente do OneDrive tem precedência (T076f)', async () => {
  const { pasta } = await gravarArquivos([], {
    nomeDaPasta: '4418 - Petrobras',
    pastaExistente: 'Obra Macaé 2026'
  });

  assert.equal(pasta, 'ZZ - Testes/Obra Macaé 2026');
});

test('em `fake` nada sai para a rede, e a contagem volta', async () => {
  const resultado = await gravarArquivos(
    [
      { fileName: 'Proposta Comercial - 4418.pdf', bytes: Buffer.from('%PDF') },
      { fileName: 'Proposta Técnica - 4418.pdf', bytes: Buffer.from('%PDF') },
      { fileName: 'Levantamento de Custos - 4418.csv', bytes: Buffer.from('a;b') }
    ],
    { nomeDaPasta: '4418' }
  );

  assert.equal(resultado.arquivos, 3);
});

test('em `fake` a integração está disponível; em `off`, não', () => {
  assert.equal(indisponivel(), '');
});
