import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.COMERCIAL_DIR = await mkdtemp(path.join(tmpdir(), 'comercial-docs-'));

const {
  caminhoAbsoluto,
  gravarArquivo,
  lerArquivo,
  normalizarCodigo,
  pastaDaEmissao,
  raizComercial
} = await import('../src/lib/comercial/storage.js');
const {
  baixarDocumento,
  dadosDoDocumento,
  documentosAtuais,
  emitirDocumentos,
  nomeDoArquivo,
  rotuloDaProposta
} = await import('../src/lib/comercial/documentos.js');
const { attachmentContentDisposition } = await import('../src/lib/documents/storage.js');

/**
 * Armazenamento e emissão dos documentos (tarefas T074 e T075).
 *
 * **Roda sem LibreOffice.** O gerador entra por parâmetro, e aqui ele devolve
 * bytes de mentira — o que precisa ser provado não é o desenho do PDF (que a
 * suíte do `.docx` já cobre), e sim a ORDEM: gerar, gravar em disco, e só então
 * registrar. É essa ordem que sustenta o FR-034 na finalização.
 *
 * `COMERCIAL_DIR` aponta para uma pasta temporária, definida antes do import —
 * `env.js` lê a variável uma vez, na carga.
 */

const raiz = process.env.COMERCIAL_DIR;

test.after(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const vendedorA = { id: 'u-vend-a', name: 'Vendedor A', moduleRoles: ['comercial:seller'] };
const vendedorB = { id: 'u-vend-b', name: 'Vendedor B', moduleRoles: ['comercial:seller'] };
const gestor = { id: 'u-gestor', name: 'Gestora', moduleRoles: ['comercial:manager'] };
const consulta = { id: 'u-consulta', name: 'Consulta', moduleRoles: ['comercial:viewer'] };

function propostaBase(extra = {}) {
  return {
    id: 'p1',
    proposalCode: '4418',
    revisionNumber: 0,
    status: 'RASCUNHO',
    archivedAt: null,
    createdByUserId: 'u-vend-a',
    sellerName: 'Vendedor A',
    estimatorName: 'Orçamentista',
    payload: { client: 'Petrobras', prices: [{ value: 'R$ 100,00' }] },
    ...extra
  };
}

function fakePrisma(propostas = []) {
  const store = { propostas: [...propostas], documentos: [] };
  let sequencia = 0;

  const proposalDocument = {
    create: ({ data }) => {
      const row = { id: `d${++sequencia}`, createdAt: new Date(Date.now() + sequencia), ...data };
      // O `create` do Prisma dentro de `$transaction([...])` devolve promessa;
      // o array é executado pelo `$transaction`. Aqui a gravação já aconteceu.
      store.documentos.push(row);
      return Promise.resolve(row);
    },
    findMany: async ({ where, orderBy }) => {
      const items = store.documentos.filter(d => d.proposalId === where.proposalId);
      if (orderBy?.createdAt === 'desc') items.sort((a, b) => b.createdAt - a.createdAt);
      return items;
    },
    findUnique: async ({ where, include }) => {
      const documento = store.documentos.find(d => d.id === where.id);
      if (!documento) return null;
      if (!include?.proposal) return documento;
      return {
        ...documento,
        proposal: store.propostas.find(p => p.id === documento.proposalId) || null
      };
    }
  };

  return {
    store,
    proposal: {
      findUnique: async ({ where }) => store.propostas.find(p => p.id === where.id) || null
    },
    proposalDocument,
    $transaction: async operacoes => Promise.all(operacoes)
  };
}

/** Gerador de mentira: devolve bytes reconhecíveis por tipo. */
function geradorFalso(registro = []) {
  return async (dados, tipo) => {
    registro.push({ tipo, dados });
    return Buffer.from(`%PDF-${tipo}-${dados.proposalCode}`);
  };
}

// ---------------------------------------------------------------------------
// storage.js — caminhos
// ---------------------------------------------------------------------------

test('a raiz é a COMERCIAL_DIR do ambiente', () => {
  assert.equal(path.resolve(raizComercial()), path.resolve(raiz));
});

test('o código vira nome de pasta sem acento e sem barra', () => {
  assert.equal(normalizarCodigo('4418'), '4418');
  assert.equal(normalizarCodigo('4418 Rev 2'), '4418-Rev-2');
  assert.equal(normalizarCodigo('proposta ação'), 'proposta-acao');
  assert.equal(normalizarCodigo(''), 'sem-numero');
  assert.equal(normalizarCodigo(null), 'sem-numero');

  // O código chega de um campo de texto e vai virar segmento de caminho. A
  // barra some, então o que sobra é UM segmento — `..-..-etc-passwd` não sobe
  // pasta nenhuma.
  assert.equal(normalizarCodigo('../../etc/passwd'), '..-..-etc-passwd');

  // Mas o ponto é permitido, e um código feito só de pontos sobreviveria como
  // `..`, que continua sendo "suba um nível" depois de virar caminho.
  assert.equal(normalizarCodigo('..'), 'sem-numero');
  assert.equal(normalizarCodigo('.'), 'sem-numero');
});

test('código de pontos não tira o arquivo da pasta de propostas', () => {
  // A regressão que o caso acima existe para impedir: `propostas/../<id>` ainda
  // ficaria dentro da raiz — `caminhoAbsoluto` não reclamaria — mas fora da
  // pasta de propostas, e ninguém notaria.
  assert.equal(pastaDaEmissao('..', 'id-um'), 'propostas/sem-numero/id-um');
});

test('caminho que escapa da raiz é recusado, não lido', async () => {
  assert.throws(
    () => caminhoAbsoluto('../fora.pdf'),
    error => error.statusCode === 400
  );
  assert.throws(
    () => caminhoAbsoluto('propostas/../../fora.pdf'),
    error => error.statusCode === 400
  );

  // E o caminho legítimo continua resolvendo dentro da raiz.
  assert.ok(caminhoAbsoluto('propostas/4418/abc/commercial.pdf').startsWith(path.resolve(raiz)));
});

test('a pasta da emissão é nova a cada emissão', () => {
  const a = pastaDaEmissao('4418', 'id-um');
  const b = pastaDaEmissao('4418', 'id-dois');

  assert.equal(a, 'propostas/4418/id-um');
  assert.notEqual(a, b, 'reemitir sobrescreveria o arquivo que alguém já baixou');
});

test('gravar devolve caminho relativo, e ler traz os bytes de volta', async () => {
  const { storagePath, byteSize } = await gravarArquivo(
    'propostas/4418/teste/commercial.pdf',
    Buffer.from('%PDF-conteudo')
  );

  // Caminho absoluto no banco amarraria o registro à máquina.
  assert.equal(storagePath, 'propostas/4418/teste/commercial.pdf');
  assert.ok(!path.isAbsolute(storagePath));
  assert.equal(byteSize, 13);

  const bytes = await lerArquivo(storagePath);
  assert.equal(bytes.toString(), '%PDF-conteudo');
});

test('arquivo que sumiu do disco vira 404 com texto, não ENOENT', async () => {
  // Backup restaurado pela metade, pasta movida: o registro existe e o arquivo
  // não. "ENOENT" não diz isso a ninguém.
  await assert.rejects(
    () => lerArquivo('propostas/4418/nao-existe/commercial.pdf'),
    error => {
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// Os dados do documento vêm do REGISTRO
// ---------------------------------------------------------------------------

test('código, revisão, vendedor e orçamentista sobrescrevem o payload', () => {
  // Um payload salvo antes de o gestor trocar o consultor imprimiria o nome
  // errado no documento que vai ao cliente.
  const dados = dadosDoDocumento(
    propostaBase({
      revisionNumber: 2,
      payload: {
        client: 'Petrobras',
        proposalCode: '0000',
        seller: 'Nome Antigo',
        estimator: 'Outro'
      }
    })
  );

  assert.equal(dados.proposalCode, '4418');
  assert.equal(dados.revision, '2');
  assert.equal(dados.seller, 'Vendedor A');
  assert.equal(dados.estimator, 'Orçamentista');
  assert.equal(dados.client, 'Petrobras', 'o resto do formulário tem de sobreviver');
});

test('o nome do arquivo recompõe a revisão que a referência guardava no código', () => {
  assert.equal(rotuloDaProposta('4418', 0), '4418');
  assert.equal(rotuloDaProposta('4418', 2), '4418 Rev 2');
  assert.equal(nomeDoArquivo('COMERCIAL', '4418', 0), 'Proposta Comercial - 4418.pdf');
  assert.equal(nomeDoArquivo('TECNICA', '4418', 2), 'Proposta Técnica - 4418 Rev 2.pdf');
});

// ---------------------------------------------------------------------------
// Emissão — gerar, gravar, registrar, nessa ordem
// ---------------------------------------------------------------------------

test('emite os dois documentos, grava em disco e registra', async () => {
  const prisma = fakePrisma([propostaBase()]);
  const chamadas = [];

  const resultado = await emitirDocumentos(prisma, vendedorA, 'p1', {
    gerarPdf: geradorFalso(chamadas)
  });

  assert.deepEqual(chamadas.map(c => c.tipo), ['commercial', 'technical']);
  assert.equal(resultado.documentos.length, 2);
  assert.deepEqual(resultado.documentos.map(d => d.kind), ['COMERCIAL', 'TECNICA']);
  assert.deepEqual(resultado.documentos.map(d => d.fileName), [
    'Proposta Comercial - 4418.pdf',
    'Proposta Técnica - 4418.pdf'
  ]);

  // Os bytes estão MESMO no disco, no caminho que o registro aponta.
  for (const documento of prisma.store.documentos) {
    const bytes = await readFile(path.join(raiz, documento.storagePath));
    assert.match(bytes.toString(), /^%PDF-/);
    assert.equal(documento.byteSize, bytes.length);
  }
});

test('o arquivo vai para o disco ANTES de o registro existir', async () => {
  // É a ordem inteira desta tarefa. Na ordem inversa, uma falha na gravação
  // deixaria no banco um documento que o download não encontra — e o registro
  // pareceria bom até alguém clicar.
  const prisma = fakePrisma([propostaBase()]);
  const criadoQuandoJaHaviaArquivo = [];

  const original = prisma.proposalDocument.create;
  prisma.proposalDocument.create = ({ data }) => {
    criadoQuandoJaHaviaArquivo.push(existsSync(path.join(raiz, data.storagePath)));
    return original({ data });
  };

  await emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() });

  assert.deepEqual(criadoQuandoJaHaviaArquivo, [true, true]);
});

test('PDF vazio interrompe a emissão em vez de gravar arquivo de zero byte', async () => {
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(
    () => emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: async () => Buffer.alloc(0) }),
    error => error.statusCode === 500
  );

  assert.equal(prisma.store.documentos.length, 0);
});

test('vendedor não emite documento de proposta de outro autor', async () => {
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(
    () => emitirDocumentos(prisma, vendedorB, 'p1', { gerarPdf: geradorFalso() }),
    error => error.statusCode === 403
  );

  assert.equal(prisma.store.documentos.length, 0, 'gerou documento sem permissão');
});

test('o gestor emite documento de qualquer proposta', async () => {
  const prisma = fakePrisma([propostaBase()]);

  const resultado = await emitirDocumentos(prisma, gestor, 'p1', { gerarPdf: geradorFalso() });
  assert.equal(resultado.documentos.length, 2);
});

test('proposta já finalizada não reemite — o caminho é revisar', async () => {
  // Um par novo com conteúdo diferente circularia com o mesmo número.
  const prisma = fakePrisma([propostaBase({ status: 'FINALIZADA' })]);

  await assert.rejects(
    () => emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() }),
    error => error.statusCode === 409
  );
});

test('a finalização em curso PODE emitir — é ela quem chama', async () => {
  const prisma = fakePrisma([propostaBase({ status: 'FINALIZANDO' })]);

  const resultado = await emitirDocumentos(prisma, vendedorA, 'p1', {
    gerarPdf: geradorFalso()
  });

  assert.equal(resultado.documentos.length, 2);
});

test('proposta arquivada não emite', async () => {
  const prisma = fakePrisma([propostaBase({ archivedAt: new Date() })]);

  await assert.rejects(
    () => emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() }),
    error => error.statusCode === 409
  );
});

test('proposta inexistente é 404', async () => {
  const prisma = fakePrisma();

  await assert.rejects(
    () => emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() }),
    error => error.statusCode === 404
  );
});

test('emitir de novo cria par novo, sem apagar o anterior', async () => {
  const prisma = fakePrisma([propostaBase()]);

  const primeira = await emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() });
  const segunda = await emitirDocumentos(prisma, vendedorA, 'p1', { gerarPdf: geradorFalso() });

  assert.equal(prisma.store.documentos.length, 4, 'nada é apagado neste módulo');

  // E "o documento da proposta" passa a ser o último de cada tipo.
  const atuais = await documentosAtuais(prisma, 'p1');
  assert.equal(atuais.length, 2);
  assert.deepEqual(
    atuais.map(d => d.id).sort(),
    segunda.documentos.map(d => d.id).sort()
  );
  assert.ok(!atuais.some(d => primeira.documentos.some(p => p.id === d.id)));
});

test('emitir sem gerador é erro de programação, não 500 silencioso', async () => {
  const prisma = fakePrisma([propostaBase()]);
  await assert.rejects(() => emitirDocumentos(prisma, vendedorA, 'p1'), TypeError);
});

// ---------------------------------------------------------------------------
// Download — T079, onde as regras dos três papéis divergem
// ---------------------------------------------------------------------------

/** Emite um par e devolve os dois documentos por tipo. */
async function comDocumentosEmitidos(proposta = propostaBase()) {
  const prisma = fakePrisma([proposta]);
  const { documentos } = await emitirDocumentos(prisma, gestor, proposta.id, {
    gerarPdf: geradorFalso()
  });
  const porTipo = Object.fromEntries(documentos.map(d => [d.kind, d.id]));
  return { prisma, porTipo };
}

test('o autor baixa os dois documentos da sua proposta', async () => {
  const { prisma, porTipo } = await comDocumentosEmitidos();

  for (const kind of ['COMERCIAL', 'TECNICA']) {
    const { bytes, fileName } = await baixarDocumento(prisma, vendedorA, porTipo[kind]);
    assert.match(bytes.toString(), /^%PDF-/);
    assert.match(fileName, /^Proposta (Comercial|Técnica) - 4418\.pdf$/);
  }
});

test('vendedor não baixa documento de proposta de outro autor', async () => {
  const { prisma, porTipo } = await comDocumentosEmitidos();

  await assert.rejects(
    () => baixarDocumento(prisma, vendedorB, porTipo.TECNICA),
    error => error.statusCode === 403
  );
});

test('O CASO CRÍTICO: a consulta pede a COMERCIAL e leva 403 DA ROTA', async () => {
  // Não é botão escondido. A proposta comercial traz tabela de preços,
  // condições de pagamento e valor total: servi-la a quem não pode ver valores
  // contornaria a restrição por outra porta, e ela deixaria de valer para
  // qualquer um com o link.
  const { prisma, porTipo } = await comDocumentosEmitidos();

  await assert.rejects(
    () => baixarDocumento(prisma, consulta, porTipo.COMERCIAL),
    error => {
      assert.equal(error.statusCode, 403);
      assert.match(error.message, /técnica/i, 'a mensagem precisa dizer o que ele PODE baixar');
      return true;
    }
  );
});

test('a consulta baixa a TÉCNICA — inclusive de proposta de outro autor', async () => {
  // Aqui a autoria não vale para ela: a listagem de propostas é a superfície
  // inteira do papel de consulta, e a técnica não carrega valor nenhum.
  const { prisma, porTipo } = await comDocumentosEmitidos();

  const { bytes } = await baixarDocumento(prisma, consulta, porTipo.TECNICA);
  assert.match(bytes.toString(), /^%PDF-/);
});

test('o gestor baixa documento de qualquer proposta', async () => {
  const { prisma, porTipo } = await comDocumentosEmitidos();

  const { bytes } = await baixarDocumento(prisma, gestor, porTipo.COMERCIAL);
  assert.match(bytes.toString(), /^%PDF-/);
});

test('documento inexistente é 404', async () => {
  const prisma = fakePrisma([propostaBase()]);

  await assert.rejects(
    () => baixarDocumento(prisma, gestor, 'd-fantasma'),
    error => error.statusCode === 404
  );
});

test('registro que aponta para arquivo sumido é 404, não erro cru', async () => {
  const { prisma, porTipo } = await comDocumentosEmitidos();
  const documento = prisma.store.documentos.find(d => d.id === porTipo.TECNICA);
  documento.storagePath = 'propostas/4418/sumiu/technical.pdf';

  await assert.rejects(
    () => baixarDocumento(prisma, gestor, porTipo.TECNICA),
    error => error.statusCode === 404
  );
});

test('o nome com acento sobrevive ao cabeçalho, nas duas formas', () => {
  // "Proposta Técnica" tem acento, e nem todo cliente entende `filename*`. Sem a
  // versão dobrada o nome chega quebrado, ou o cabeçalho inteiro é descartado.
  const cabecalho = attachmentContentDisposition('Proposta Técnica - 4418.pdf');

  assert.match(cabecalho, /^attachment; /);
  assert.match(cabecalho, /filename="Proposta Tecnica - 4418\.pdf"/);
  assert.match(cabecalho, /filename\*=UTF-8''Proposta%20T%C3%A9cnica%20-%204418\.pdf/);
});
