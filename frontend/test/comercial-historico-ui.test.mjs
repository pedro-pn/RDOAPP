import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

/** Histórico comercial (T084): paridade dos textos e restrição do viewer. */

let server;
let historico;
let historicoLevantamentos;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom'
  });
  historico = await server.ssrLoadModule('/src/pages/comercial/historico/HistoricoTabela.tsx');
  historicoLevantamentos = await server.ssrLoadModule(
    '/src/pages/comercial/historico/HistoricoLevantamentosTabela.tsx'
  );
});

test.after(async () => {
  await server?.close();
});

const proposta = {
  id: 'p1',
  proposalCode: '4418',
  revisionNumber: 2,
  clientName: 'Petrobras',
  title: 'Filtragem de óleo isolante',
  site: 'Macaé',
  contact: 'Fulano',
  email: 'fulano@cliente.com',
  sellerName: 'Vendedora',
  estimatorName: 'Orçamentista',
  totalValue: '10000.00',
  totalCost: '8500.00',
  marginPercent: '15.00',
  costEstimateId: 'c1',
  status: 'FINALIZADA',
  nectarStatus: 'SUCESSO',
  sharepointStatus: 'ERRO',
  nectarPipelineId: '47518',
  nectarPipelineName: 'Gestão Comercial',
  nectarOpportunityId: 'op-1',
  sharepointFolder: '/Propostas/4418',
  integrationError: 'SharePoint indisponível.',
  finalizedAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  documents: [
    { id: 'dc', kind: 'COMERCIAL', fileName: 'Proposta Comercial.pdf', byteSize: 10 },
    { id: 'dt', kind: 'TECNICA', fileName: 'Proposta Técnica.pdf', byteSize: 20 }
  ]
};

test('orçamentista vê revisão, valores, integrações e os dois arquivos', () => {
  const html = renderToStaticMarkup(
    createElement(historico.HistoricoTabela, {
      propostas: [proposta],
      podeVerValores: true,
      onBaixarDocumento: () => {}
    })
  );

  assert.match(html, /4418 Rev 2/);
  assert.match(html, /R\$\s*10\.000,00/);
  assert.match(html, /Custo:/);
  assert.match(html, /Gestão Comercial/);
  assert.match(html, /Baixar comercial/);
  assert.match(html, /Baixar técnica/);
});

test('viewer não recebe coluna de valor nem link para o documento comercial', () => {
  const html = renderToStaticMarkup(
    createElement(historico.HistoricoTabela, {
      propostas: [{ ...proposta, totalValue: undefined, totalCost: undefined, marginPercent: undefined }],
      podeVerValores: false,
      onBaixarDocumento: () => {}
    })
  );

  assert.doesNotMatch(html, />Valor</);
  assert.doesNotMatch(html, /R\$\s*10\.000,00/);
  assert.doesNotMatch(html, /Baixar comercial/);
  assert.match(html, /Baixar técnica/);
});

test('o histórico mostra levantamento salvo e permite reabri-lo', () => {
  const levantamento = {
    id: 'c1',
    proposalCode: '4418',
    revisionNumber: 0,
    title: 'Flushing da unidade',
    mode: 'NOVA',
    status: 'SALVO',
    totalCost: '8500.00',
    salePrice: '10000.00',
    marginPercent: '15.00',
    updatedAt: '2026-08-31T15:00:00.000Z'
  };
  const html = renderToStaticMarkup(
    createElement(historicoLevantamentos.HistoricoLevantamentosTabela, {
      levantamentos: [levantamento],
      onAbrir: () => {}
    })
  );

  assert.match(html, /4418/);
  assert.match(html, /Flushing da unidade/);
  assert.match(html, /Salvo/);
  assert.match(html, /R\$\s*10\.000,00/);
  assert.match(html, /Abrir levantamento/);
});
