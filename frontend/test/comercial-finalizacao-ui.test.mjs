import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

/**
 * Finalização da proposta no navegador (T081–T083).
 *
 * A rota já garante a ordem irreversível no servidor. Aqui protegemos o que é
 * fácil perder no porte da referência: a ordem das mensagens, a primeira
 * pendência específica e os três caminhos de download dos dois PDFs salvos.
 */

let server;
let fluxo;
let painel;
let api;
let revisao;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom'
  });
  fluxo = await server.ssrLoadModule(
    '/src/pages/comercial/proposta/finalizacao.ts'
  );
  painel = await server.ssrLoadModule(
    '/src/pages/comercial/proposta/FinalizacaoPanel.tsx'
  );
  revisao = await server.ssrLoadModule(
    '/src/pages/comercial/proposta/steps/RevisaoStep.tsx'
  );
  api = await server.ssrLoadModule('/src/api/comercial.ts');
});

test.after(async () => {
  await server?.close();
});

function entrada(extra = {}) {
  return {
    email: 'fulano@cliente.com.br',
    cnpj: '33.000.167/0001-01',
    department: 'Manutenção',
    seller: 'u-vendedor',
    estimator: 'Orçamentista',
    pipelineId: '47518',
    companyId: 'empresa-1',
    contactId: 'contato-1',
    cardChoice: 'create',
    existingOpportunityId: '',
    ...extra
  };
}

test('anuncia os quatro estágios na ordem e no texto da referência', () => {
  assert.deepEqual(
    fluxo.ETAPAS_VISIVEIS_DA_FINALIZACAO.map((item) => item.mensagem),
    [
      'Preparando a proposta comercial...',
      'Proposta comercial pronta. Preparando a proposta técnica...',
      'As duas propostas foram geradas. Salvando no histórico...',
      'As duas propostas foram salvas. Escolha abaixo quais deseja baixar.'
    ]
  );
  assert.deepEqual(
    fluxo.ETAPAS_VISIVEIS_DA_FINALIZACAO.map((item) => item.etapaTecnica),
    [
      'geração dos PDFs',
      'preparação dos arquivos',
      'envio às integrações',
      'leitura da resposta'
    ]
  );
});

test('aceita a finalização completa com criação de card novo', () => {
  assert.equal(fluxo.validarFinalizacao(entrada()), '');
});

test('devolve só a primeira pendência, com mensagem específica e ordem estável', () => {
  assert.equal(
    fluxo.validarFinalizacao(
      entrada({
        email: 'sem-arroba',
        cnpj: '',
        seller: '',
        pipelineId: '',
        companyId: '',
        cardChoice: ''
      })
    ),
    'Informe um e-mail válido, como nome@empresa.com ou nome@empresa.com.br.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ cnpj: '12.345' })),
    'Informe um CNPJ válido com 14 dígitos.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ department: '0' })),
    'Informe o departamento correto ou deixe o campo em branco.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ estimator: '' })),
    'Selecione o consultor de vendas e o orçamentista.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ pipelineId: '' })),
    'Selecione o funil do Nectar.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ contactId: '' })),
    'Selecione a empresa e o contato diretamente pelo Nectar antes de finalizar.'
  );
  assert.equal(
    fluxo.validarFinalizacao(entrada({ cardChoice: '' })),
    'Escolha se deseja usar um card existente ou criar um card novo no Nectar.'
  );
});

test('card existente exige o id do card; vínculo herdado satisfaz a regra', () => {
  assert.equal(
    fluxo.validarFinalizacao(
      entrada({ cardChoice: 'existing', existingOpportunityId: '' })
    ),
    'Localize e selecione o card existente do Nectar antes de finalizar.'
  );
  assert.equal(
    fluxo.validarFinalizacao(
      entrada({ cardChoice: 'existing', existingOpportunityId: 'op-4418' })
    ),
    ''
  );
});

test('Nectar indisponível não bloqueia a emissão dos documentos', () => {
  assert.equal(
    fluxo.validarFinalizacao(
      entrada({
        exigirIntegracao: false,
        pipelineId: '',
        companyId: '',
        contactId: '',
        cardChoice: ''
      })
    ),
    ''
  );
});

test('a pendência informa a etapa e o campo exatos para navegação', () => {
  assert.deepEqual(
    fluxo.primeiraPendenciaDaFinalizacao(entrada({ contactId: '' })),
    {
      mensagem:
        'Selecione a empresa e o contato diretamente pelo Nectar antes de finalizar.',
      etapa: 'cliente',
      campo: 'empresaCrm'
    }
  );
});

const documentos = [
  { id: 'dc', kind: 'COMERCIAL', fileName: 'Comercial.pdf', byteSize: 10 },
  { id: 'dt', kind: 'TECNICA', fileName: 'Tecnica.pdf', byteSize: 20 }
];

test('a escolha altera só o download, nunca o par de documentos salvo', () => {
  assert.deepEqual(
    fluxo.documentosEscolhidos(documentos, 'both').map((item) => item.id),
    ['dc', 'dt']
  );
  assert.deepEqual(
    fluxo.documentosEscolhidos(documentos, 'commercial').map((item) => item.id),
    ['dc']
  );
  assert.deepEqual(
    fluxo.documentosEscolhidos(documentos, 'technical').map((item) => item.id),
    ['dt']
  );
  assert.equal(
    documentos.length,
    2,
    'a lista emitida não pode ser filtrada em memória'
  );
});

test('o painel oferece o download escolhido e os dois downloads separados', () => {
  const html = renderToStaticMarkup(
    createElement(painel.FinalizacaoPanel, {
      documentos,
      escolha: 'both',
      baixandoId: '',
      onBaixar: () => {}
    })
  );

  assert.match(html, /Baixar técnica \+ comercial/);
  assert.match(html, /Baixar separadamente a proposta comercial/);
  assert.match(html, /Baixar separadamente a proposta técnica/);
});

test('a etapa de revisão mostra funil, destino e a pendência pré-finalização', () => {
  const html = renderToStaticMarkup(
    createElement(revisao.RevisaoStep, {
      form: { client: 'Petrobras', companyId: '', contactId: '' },
      codigo: '4418',
      vinculoCrm: null,
      funis: [{ id: '47518', nome: 'Gestão Comercial', primeiraEtapa: 1 }],
      funisCarregando: false,
      funisMensagem: '',
      funilId: '47518',
      onFunil: () => {},
      escolhaCard: 'create',
      onEscolhaCard: () => {},
      escolha: 'both',
      onEscolha: () => {},
      pastaOneDrive: '',
      onPastaOneDrive: () => {},
      anexos: [],
      onAnexos: () => {},
      anexosEnviados: [],
      removendoAnexoId: '',
      onRemoverAnexo: () => {},
      erroFinalizacao:
        'Selecione a empresa e o contato diretamente pelo Nectar antes de finalizar.',
      bloqueada: false
    })
  );

  assert.match(html, /Gestão Comercial/);
  assert.match(html, /Criar card novo/);
  assert.match(html, /Selecione a empresa e o contato diretamente pelo Nectar/);
});

test('a etapa de revisão explica a emissão sem Nectar', () => {
  const html = renderToStaticMarkup(
    createElement(revisao.RevisaoStep, {
      form: { client: 'Petrobras', companyId: '', contactId: '' },
      codigo: '4418',
      vinculoCrm: null,
      funis: [],
      funisCarregando: false,
      funisMensagem: 'Nectar desligado neste ambiente.',
      funilId: '',
      onFunil: () => {},
      escolhaCard: '',
      onEscolhaCard: () => {},
      escolha: 'both',
      onEscolha: () => {},
      pastaOneDrive: '',
      onPastaOneDrive: () => {},
      anexos: [],
      onAnexos: () => {},
      anexosEnviados: [],
      removendoAnexoId: '',
      onRemoverAnexo: () => {},
      erroFinalizacao: '',
      bloqueada: false
    })
  );

  assert.match(
    html,
    /documentos e o envio ao SharePoint continuarão normalmente/i
  );
  assert.match(
    html,
    /Não são obrigatórios enquanto o Nectar estiver indisponível/
  );
});

test('o 502 útil conserva os documentos e o motivo das integrações', () => {
  const resultado = api.interpretarRespostaDaFinalizacao(502, {
    error: 'SharePoint indisponível.',
    documentos,
    integracao: { status: 'SUCESSO', mensagem: '', opportunityId: 'op-1' },
    sharepoint: { status: 'ERRO', mensagem: 'SharePoint indisponível.' }
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.documentosDisponiveis, true);
  assert.equal(resultado.documentos.length, 2);
  assert.equal(resultado.sharepoint.mensagem, 'SharePoint indisponível.');
});

test('502 seco continua sendo erro: não fabrica links inexistentes', () => {
  assert.throws(
    () =>
      api.interpretarRespostaDaFinalizacao(502, {
        error: 'Falha antes dos PDFs.'
      }),
    /Falha antes dos PDFs/
  );
});
