import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.COMERCIAL_DIR = await mkdtemp(path.join(tmpdir(), 'comercial-anexos-'));

const {
  anexarArquivo,
  bytesComprometidos,
  exigirLimiteAgregado,
  extensaoDe,
  listarAnexos,
  sanearNome,
  validarAnexo
} = await import('../src/lib/comercial/anexos.js');
const { ATTACHMENT_LIMITS } = await import('../../shared/schemas/comercial.js');

/**
 * Anexos do cliente (T076d e T076e).
 *
 * O que este arquivo protege é o **limite agregado** (FR-059): cinco anexos de
 * 5 MB passam um a um e estouram juntos. Validar cada um isoladamente é o
 * defeito, e ele só aparece no meio do envio — com o card já criado no CRM.
 */

const raiz = process.env.COMERCIAL_DIR;

test.after(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const vendedorA = { id: 'u-vend-a', name: 'Vendedor A', moduleRoles: ['comercial:seller'] };
const vendedorB = { id: 'u-vend-b', name: 'Vendedor B', moduleRoles: ['comercial:seller'] };
const MB = 1024 * 1024;

function propostaBase(extra = {}) {
  return {
    id: 'p1',
    proposalCode: '4418',
    status: 'RASCUNHO',
    archivedAt: null,
    createdByUserId: 'u-vend-a',
    ...extra
  };
}

function fakePrisma(propostas = [propostaBase()], anexos = [], documentos = []) {
  const store = { propostas, anexos: [...anexos], documentos: [...documentos] };

  return {
    store,
    proposal: {
      findUnique: async ({ where }) => {
        const row = store.propostas.find(p => p.id === where.id);
        return row ? { ...row } : null;
      }
    },
    proposalDocument: {
      findMany: async ({ where }) => store.documentos.filter(d => d.proposalId === where.proposalId)
    },
    proposalAttachment: {
      findMany: async ({ where }) => store.anexos.filter(a => a.proposalId === where.proposalId),
      create: async ({ data }) => {
        const row = { id: `a${store.anexos.length + 1}`, createdAt: new Date(), ...data };
        store.anexos.push(row);
        return row;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// O nome que o cliente mandou
// ---------------------------------------------------------------------------

test('o nome perde o que destino externo nenhum aceita', () => {
  assert.equal(sanearNome('ART 2026.pdf'), 'ART 2026.pdf');
  assert.equal(sanearNome('folha: dados?.pdf'), 'folha- dados-.pdf');
  // A barra é o caso que importa: ela viraria pasta no SharePoint.
  assert.equal(sanearNome('cliente/ART.pdf'), 'cliente-ART.pdf');
  assert.equal(sanearNome(''), 'anexo');
});

test('a extensão sai em minúscula, e nome sem extensão não inventa uma', () => {
  assert.equal(extensaoDe('ART.PDF'), '.pdf');
  assert.equal(extensaoDe('documento'), '');
  // Extensão absurda é ignorada em vez de virar nome de arquivo em disco.
  assert.equal(extensaoDe('arquivo.extensaomuitolonga'), '');
});

// ---------------------------------------------------------------------------
// A cadeia de recusa
// ---------------------------------------------------------------------------

test('arquivo vazio pede o arquivo, não acusa formato', () => {
  assert.throws(
    () => validarAnexo({ bytes: Buffer.alloc(0), fileName: 'a.pdf' }),
    error => error.statusCode === 400
  );
});

test('executável é recusado — anexo é lido, não executado', () => {
  for (const nome of ['virus.exe', 'script.bat', 'macro.vbs', 'app.jar']) {
    assert.throws(
      () => validarAnexo({ bytes: Buffer.from('x'), fileName: nome }),
      error => error.statusCode === 415,
      `${nome} deveria ser recusado`
    );
  }
});

test('documento, planilha e imagem passam', () => {
  for (const nome of ['ART.pdf', 'dados.xlsx', 'foto.jpg', 'especificacao.docx']) {
    assert.doesNotThrow(() => validarAnexo({ bytes: Buffer.from('x'), fileName: nome }));
  }
});

// ---------------------------------------------------------------------------
// O LIMITE AGREGADO — o ponto da T076e
// ---------------------------------------------------------------------------

test('O CASO CRÍTICO: cinco anexos passam um a um e estouram juntos', () => {
  // 5 MB cada, sozinho, cabe folgado. Somados dão 25 MB e não cabem.
  const umAnexo = { bytes: Buffer.alloc(5 * MB), fileName: 'a.pdf' };
  assert.doesNotThrow(() => validarAnexo(umAnexo), 'um de 5 MB tem de caber');

  const cinco = Array.from({ length: 5 }, () => ({ bytes: Buffer.alloc(5 * MB) }));
  assert.throws(
    () => exigirLimiteAgregado(cinco),
    error => {
      assert.equal(error.statusCode, 413);
      return true;
    },
    'cinco de 5 MB não podem passar'
  );
});

test('a mensagem do limite diz quanto é, quanto cabe e o que fazer', () => {
  // "Arquivo muito grande" sozinho não ajuda quem tem seis anexos e não sabe
  // qual sacrificar.
  try {
    exigirLimiteAgregado([{ bytes: Buffer.alloc(21 * MB) }]);
    assert.fail('devia ter estourado');
  } catch (error) {
    assert.match(error.message, /21\.0 MB/);
    assert.match(error.message, /20\.0 MB/);
    assert.match(error.message, /Remova ou compacte/);
  }
});

test('o que já está comprometido entra na conta do anexo novo', async () => {
  // O upload seguinte precisa saber dos documentos e dos anexos que já existem.
  const prisma = fakePrisma(
    [propostaBase()],
    [{ proposalId: 'p1', byteSize: 8 * MB }],
    [{ proposalId: 'p1', byteSize: 6 * MB, createdAt: new Date() }]
  );

  assert.equal(await bytesComprometidos(prisma, 'p1'), 14 * MB);

  await assert.rejects(
    () => anexarArquivo(prisma, vendedorA, 'p1', {
      bytes: Buffer.alloc(7 * MB),
      fileName: 'grande.pdf'
    }),
    error => error.statusCode === 413
  );

  assert.equal(prisma.store.anexos.length, 1, 'não pode gravar o que não cabe');
});

test('cabendo, o anexo é gravado com nome saneado e tamanho real', async () => {
  const prisma = fakePrisma();

  const anexo = await anexarArquivo(prisma, vendedorA, 'p1', {
    bytes: Buffer.from('conteudo do anexo'),
    fileName: 'ART: 2026.pdf'
  });

  assert.equal(anexo.originalName, 'ART- 2026.pdf');
  assert.equal(anexo.byteSize, 17);
  assert.equal(anexo.createdByUserId, 'u-vend-a');
  // O arquivo em disco tem nome de UUID, sob a pasta da proposta.
  assert.match(anexo.storagePath, /^propostas\/4418\/anexos\/[0-9a-f-]+\.pdf$/);
});

// ---------------------------------------------------------------------------
// Autoria e estado
// ---------------------------------------------------------------------------

test('vendedor não anexa em proposta de outro autor', async () => {
  const prisma = fakePrisma();

  await assert.rejects(
    () => anexarArquivo(prisma, vendedorB, 'p1', { bytes: Buffer.from('x'), fileName: 'a.pdf' }),
    error => error.statusCode === 403
  );
});

test('proposta finalizada não recebe anexo', async () => {
  // Ele ficaria só no nosso disco — visível na tela e ausente do destino, que é
  // pior que não aceitar.
  const prisma = fakePrisma([propostaBase({ status: 'FINALIZADA' })]);

  await assert.rejects(
    () => anexarArquivo(prisma, vendedorA, 'p1', { bytes: Buffer.from('x'), fileName: 'a.pdf' }),
    error => error.statusCode === 409
  );
});

test('proposta arquivada não recebe anexo', async () => {
  const prisma = fakePrisma([propostaBase({ archivedAt: new Date() })]);

  await assert.rejects(
    () => anexarArquivo(prisma, vendedorA, 'p1', { bytes: Buffer.from('x'), fileName: 'a.pdf' }),
    error => error.statusCode === 409
  );
});

test('a listagem diz quanto do limite já foi usado', async () => {
  const prisma = fakePrisma([propostaBase()], [{ proposalId: 'p1', byteSize: 3 * MB, originalName: 'ART.pdf', createdAt: new Date() }]);

  const { items, total, bytesUsados, bytesDisponiveis } = await listarAnexos(
    prisma,
    vendedorA,
    'p1'
  );

  assert.equal(total, 1);
  assert.equal(items[0].originalName, 'ART.pdf');
  assert.equal(bytesUsados, 3 * MB);
  assert.equal(bytesDisponiveis, ATTACHMENT_LIMITS.maxAggregateBytes);
});
