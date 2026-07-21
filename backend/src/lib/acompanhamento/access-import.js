/*
 * Importação do banco comercial Access (propostas_bd.accdb) — módulo Acompanhamento de Projetos.
 *
 * Lê a tabela `proposta`, normaliza os campos (vários vêm como texto/nulo), grava o staging 1:1
 * (CommercialProposal, upsert por cod_bd) e deriva o orçamento previsto (ProjectBudget) da maior
 * revisão por proposta, criando Project pendente quando não houver correspondência.
 */

import { createHash } from 'node:crypto';

import MDBReader from 'mdb-reader';

import prisma from '../prisma.js';
import { computeProgressForProjects } from './avanco.js';
import { buildOmieCostCategoryWhere } from './cost-categories.js';
import { buildPresumedProfitTaxEstimate } from './presumed-profit-taxes.js';
import { progressContributionWeight } from './progress-groups.js';
import { getStockConsumptionCostByProject } from './stock-cost.js';

const PROPOSAL_TABLE = 'proposta';

// --- Normalização tolerante (a origem mistura number, bigint, texto e nulo) ---

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  // texto: remove tudo que não for dígito/sinal/separador e trata vírgula decimal BR
  let text = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!text) return null;
  // remove separador de milhar "." quando seguido de 3 dígitos; troca vírgula decimal por ponto
  text = text.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : null;
}

export function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

export function toStr(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// CNPJ é identificador, não número: preserva como string só com dígitos.
export function toCnpj(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits === '' ? null : digits;
}

// Venda = valor_inloco se != 0; senão valor_pop_sede (campos quase exclusivos).
export function deriveSale(row) {
  const inloco = toNumber(row.valor_inloco);
  const popSede = toNumber(row.valor_pop_sede);
  if (inloco !== null && inloco !== 0) {
    return { serviceModality: 'INLOCO', salePrice: inloco, expectedMargin: toNumber(row.margem_inloco) };
  }
  if (popSede !== null && popSede !== 0) {
    return { serviceModality: 'POP_SEDE', salePrice: popSede, expectedMargin: toNumber(row.margem_pop_sede) };
  }
  return { serviceModality: null, salePrice: null, expectedMargin: null };
}

// Mapeia uma linha bruta do Access para o shape do staging CommercialProposal.
export function mapProposalRow(row) {
  const { serviceModality, salePrice, expectedMargin } = deriveSale(row);
  return {
    codBd: toInt(row.cod_bd),
    codProp: toInt(row.cod_prop),
    nRev: toInt(row.n_rev) ?? 0,
    codNectar: toInt(row.cod_nectar),
    proposalDate: toDate(row.data_proposta),
    createdInAccessAt: toDate(row.dataCriacao),
    modifiedInAccessAt: toDate(row.dataMod),
    clientName: toStr(row.nome_cliente),
    clientCnpj: toCnpj(row.n_cnpj),
    contactName: toStr(row.contato_cliente),
    contactEmail: toStr(row.email_cliente),
    localObra: toStr(row.local_obra),
    sede: toStr(row.sede),
    elaborador: toStr(row.elaborador_proposta),
    vendedor: toStr(row.nome_vendedor),
    serviceModality,
    salePrice,
    plannedCost: toNumber(row.valor_custos),
    expectedProfit: toNumber(row.valor_lucro),
    expectedMargin,
    taxes: toNumber(row.valor_imp),
    plannedDays: toInt(row.n_dias),
    workedDays: toInt(row.n_dias_trabalhados),
    mobilizationLeadDays: toInt(row.prev_atende),
    numOperators: toInt(row.n_operadores),
    numSupervisors: toInt(row.n_encarregado),
    numPerDay: toInt(row.n_p_dia),
    numPerNight: toInt(row.n_p_noite),
    isComplete: salePrice !== null,
    components: componentsFromRow(row),
    rawRow: serializeRaw(row)
  };
}

// Componentes de custo/preço normalizados (também usado no backfill a partir do rawRow).
export function componentsFromRow(row) {
  return {
    he: toNumber(row.valor_he),
    standby: toNumber(row.valor_standby),
    diaria: toNumber(row.valor_diaria),
    analise: toNumber(row.valor_analise),
    mobEquipe: toNumber(row.valor_mob_equipe),
    mobEquipamento: toNumber(row.valor_mob_equipamento),
    desmobExtra: toNumber(row.valor_desmob_extra),
    diariaEquipamento: toNumber(row.diaria_equipamento),
    elemento: toNumber(row.valor_elemento),
    litro: toNumber(row.valor_litro),
    efluente: toNumber(row.total_efluente),
    adto: toNumber(row.adto)
  };
}

// JSON precisa de bigint serializável.
function serializeRaw(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'bigint' ? value.toString() : value;
  }
  return out;
}

export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// Lê o .accdb e devolve as linhas brutas da tabela `proposta`.
export function readProposals(buffer) {
  const reader = new MDBReader(buffer);
  const tables = reader.getTableNames();
  if (!tables.includes(PROPOSAL_TABLE)) {
    throw new Error(`Tabela "${PROPOSAL_TABLE}" não encontrada no arquivo Access. Tabelas: ${tables.join(', ')}`);
  }
  return reader.getTable(PROPOSAL_TABLE).getData();
}

// Extrai o "código do contrato" (número da proposta) da primeira parte de um texto.
// Ex.: "4096 - Rev. 1" -> 4096 · "4096" -> 4096 · "Sede 4096" -> 4096.
export function contractToProposalCode(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

// Número da proposta associado a um projeto, pela 1ª parte do contrato (fallback no código).
function projectProposalCode(project) {
  return contractToProposalCode(project.contractCode) ?? contractToProposalCode(project.code);
}

// Campos do orçamento a partir de uma proposta (tanto do mapeamento do import quanto da linha
// já persistida em CommercialProposal — ambas usam plannedCost).
function budgetFieldsFromProposal(proposal) {
  return {
    sourceProposalCodBd: proposal.codBd,
    serviceModality: proposal.serviceModality ?? null,
    salePrice: proposal.salePrice ?? null,
    plannedTotalCost: proposal.plannedCost ?? null,
    expectedProfit: proposal.expectedProfit ?? null,
    expectedMargin: proposal.expectedMargin ?? null,
    taxes: proposal.taxes ?? null,
    plannedDays: proposal.plannedDays ?? null,
    mobilizationLeadDays: proposal.mobilizationLeadDays ?? null,
    isComplete: proposal.isComplete ?? false
  };
}

export function applyStockCostsToDashboardRows(rows, stockCosts) {
  for (const row of rows) {
    const stockCost = stockCosts.get(row.projectId)?.total ?? 0;
    row.stockCost = stockCost;
    if (stockCost > 0) {
      row.realizedCost = (toNumber(row.realizedOmieCost) ?? 0) + stockCost;
    }
  }
  return rows;
}

function normalizeSleepModeMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [collaboratorId, mode] of Object.entries(value)) {
    if (typeof collaboratorId !== 'string' || !collaboratorId.trim()) continue;
    if (mode === 'HOME' || mode === 'AWAY') result[collaboratorId] = mode;
  }
  return result;
}

function normalizeCollaboratorIdList(value) {
  if (!Array.isArray(value)) return [];
  const ids = [];
  const seen = new Set();
  for (const raw of value) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function addLaborCollaborator(map, collaborator, source) {
  if (!collaborator?.id) return;
  const existing = map.get(collaborator.id);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return;
  }
  map.set(collaborator.id, {
    id: collaborator.id,
    name: collaborator.name,
    role: collaborator.role ?? null,
    sources: [source]
  });
}

async function listProjectLaborCollaborators(project, sleepModeMap) {
  const manualIds = normalizeCollaboratorIdList(project.laborCollaboratorIds);
  const sleepModeIds = Object.keys(sleepModeMap);
  const rows = new Map();

  addLaborCollaborator(rows, project.operator, 'LEADER');

  const [rdoCollaborators, manualCollaborators] = await Promise.all([
    prisma.reportCollaborator.findMany({
      where: { report: { projectId: project.id, reportType: 'RDO', deletedAt: null } },
      select: { collaborator: { select: { id: true, name: true, role: true } } },
      orderBy: { collaborator: { name: 'asc' } }
    }),
    prisma.collaborator.findMany({
      where: { id: { in: [...new Set([...manualIds, ...sleepModeIds])] } },
      select: { id: true, name: true, role: true }
    })
  ]);

  for (const row of rdoCollaborators) addLaborCollaborator(rows, row.collaborator, 'RDO');
  const manualById = new Map(manualCollaborators.map(collaborator => [collaborator.id, collaborator]));
  for (const id of [...manualIds, ...sleepModeIds]) addLaborCollaborator(rows, manualById.get(id), 'MANUAL');

  return {
    laborCollaboratorIds: manualIds.filter(id => manualById.has(id)),
    laborCollaborators: Array.from(rows.values())
  };
}

// Cria/atualiza o orçamento previsto (versão única "1") com os dados da revisão informada.
// approvedAt é definido no ato da 1ª seleção (editável depois) e preservado ao trocar de revisão.
// selectionStatus permanece como está (marcação manual da vencedora — P-19).
async function upsertBudget(client, projectId, proposal) {
  const fields = budgetFieldsFromProposal(proposal);
  return client.projectBudget.upsert({
    where: { projectId_version: { projectId, version: 1 } },
    create: { projectId, version: 1, source: 'ACCESS_IMPORT', approvedAt: new Date(), ...fields },
    update: fields
  });
}

// Reespelha todos os campos comerciais materializados no orçamento da proposta selecionada.
// Campos operacionais/manuais do projeto (approvedAt, início, avanço manual, equipe etc.) são preservados.
export async function refreshSelectedProjectBudgetsFromProposals(client, { codBds = null } = {}) {
  const selectedCodBds = Array.isArray(codBds) ? Array.from(new Set(codBds.filter(Number.isInteger))) : null;
  if (selectedCodBds && selectedCodBds.length === 0) return 0;

  const budgets = await client.projectBudget.findMany({
    where: {
      sourceProposalCodBd: selectedCodBds
        ? { in: selectedCodBds }
        : { not: null }
    },
    select: {
      projectId: true,
      version: true,
      sourceProposalCodBd: true
    }
  });
  if (budgets.length === 0) return 0;

  const sourceCodBds = Array.from(new Set(budgets.map(budget => budget.sourceProposalCodBd).filter(Number.isInteger)));
  if (sourceCodBds.length === 0) return 0;

  const proposals = await client.commercialProposal.findMany({
    where: { codBd: { in: sourceCodBds } }
  });
  const proposalsByCodBd = new Map(proposals.map(proposal => [proposal.codBd, proposal]));

  let refreshed = 0;
  for (const budget of budgets) {
    const proposal = proposalsByCodBd.get(budget.sourceProposalCodBd);
    if (!proposal) continue;
    await client.projectBudget.update({
      where: { projectId_version: { projectId: budget.projectId, version: budget.version } },
      data: budgetFieldsFromProposal(proposal)
    });
    refreshed += 1;
  }
  return refreshed;
}

// Lista as revisões (linhas do Access) cujo contrato bate com o do projeto e indica a vigente.
export async function listProjectRevisions(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      commercialProposalCode: true,
      contractCode: true,
      code: true,
      startDate: true,
      mobilizationDate: true,
      manualProgressPct: true,
      offshore: true,
      laborSleepModeByCollaborator: true,
      laborCollaboratorIds: true,
      operator: { select: { id: true, name: true, role: true } }
    }
  });
  if (!project) throw new Error('Projeto não encontrado.');
  const codProp = projectProposalCode(project);
  const laborSleepModeByCollaborator = normalizeSleepModeMap(project.laborSleepModeByCollaborator);
  const labor = await listProjectLaborCollaborators(project, laborSleepModeByCollaborator);
  if (!Number.isInteger(codProp)) {
    return {
      proposalCode: null,
      currentCodBd: null,
      resolved: false,
      startDate: project.startDate ?? null,
      mobilizationDate: project.mobilizationDate ?? null,
      manualProgressPct: project.manualProgressPct ?? null,
      offshore: project.offshore ?? false,
      laborSleepModeByCollaborator,
      laborCollaboratorIds: labor.laborCollaboratorIds,
      laborCollaborators: labor.laborCollaborators,
      revisions: []
    };
  }
  const [revisions, budget] = await Promise.all([
    prisma.commercialProposal.findMany({
      where: { codProp },
      orderBy: { nRev: 'desc' },
      select: {
        codBd: true, codProp: true, nRev: true, proposalDate: true, modifiedInAccessAt: true,
        serviceModality: true, salePrice: true, plannedCost: true, expectedProfit: true,
        expectedMargin: true, taxes: true, plannedDays: true, workedDays: true,
        numOperators: true, numSupervisors: true, numPerDay: true, numPerNight: true,
        mobilizationLeadDays: true, isComplete: true
      }
    }),
    prisma.projectBudget.findUnique({
      where: { projectId_version: { projectId, version: 1 } },
      select: { sourceProposalCodBd: true, approvedAt: true, mobilizationLeadDays: true }
    })
  ]);
  return {
    proposalCode: String(codProp),
    currentCodBd: budget?.sourceProposalCodBd ?? null,
    resolved: Boolean(project.commercialProposalCode),
    approvedAt: budget?.approvedAt ?? null,
    mobilizationLeadDays: budget?.mobilizationLeadDays ?? null,
    startDate: project.startDate ?? null,
    mobilizationDate: project.mobilizationDate ?? null,
    manualProgressPct: project.manualProgressPct ?? null,
    offshore: project.offshore ?? false,
    laborSleepModeByCollaborator,
    laborCollaboratorIds: labor.laborCollaboratorIds,
    laborCollaborators: labor.laborCollaborators,
    revisions
  };
}

// Edita o cronograma: data de aprovação do contrato (no orçamento) e início real (no projeto).
// Cada campo é opcional; passar null limpa. approvedAt exige um orçamento já escolhido.
export async function setProjectSchedule(projectId, {
  approvedAt,
  startDate,
  mobilizationDate,
  manualProgressPct,
  offshore,
  laborSleepModeByCollaborator,
  laborCollaboratorIds
} = {}) {
  return prisma.$transaction(async (tx) => {
    if (approvedAt !== undefined) {
      const budget = await tx.projectBudget.findUnique({
        where: { projectId_version: { projectId, version: 1 } },
        select: { id: true }
      });
      if (!budget) throw new Error('Orçamento não encontrado para o projeto. Escolha uma revisão primeiro.');
      await tx.projectBudget.update({
        where: { projectId_version: { projectId, version: 1 } },
        data: { approvedAt: approvedAt ? new Date(approvedAt) : null }
      });
    }
    const projectData = {};
    if (startDate !== undefined) projectData.startDate = startDate ? new Date(startDate) : null;
    if (mobilizationDate !== undefined) projectData.mobilizationDate = mobilizationDate ? new Date(mobilizationDate) : null;
    if (manualProgressPct !== undefined) projectData.manualProgressPct = manualProgressPct == null ? null : manualProgressPct;
    if (offshore !== undefined) projectData.offshore = Boolean(offshore);
    if (laborSleepModeByCollaborator !== undefined) {
      projectData.laborSleepModeByCollaborator = normalizeSleepModeMap(laborSleepModeByCollaborator);
    }
    if (laborCollaboratorIds !== undefined) {
      const ids = normalizeCollaboratorIdList(laborCollaboratorIds);
      if (ids.length === 0) {
        projectData.laborCollaboratorIds = [];
      } else {
        const collaborators = await tx.collaborator.findMany({
          where: { id: { in: ids } },
          select: { id: true }
        });
        const validIds = new Set(collaborators.map(collaborator => collaborator.id));
        projectData.laborCollaboratorIds = ids.filter(id => validIds.has(id));
      }
    }
    if (Object.keys(projectData).length > 0) {
      await tx.project.update({ where: { id: projectId }, data: projectData });
    }
    return { ok: true };
  });
}

// Define qual revisão (codBd) é a que vale: recalcula o orçamento e marca o projeto como resolvido.
export async function setProjectBudgetRevision(projectId, codBd) {
  const proposal = await prisma.commercialProposal.findUnique({ where: { codBd } });
  if (!proposal) throw new Error('Revisão não encontrada.');
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, commercialProposalCode: true, contractCode: true, code: true }
  });
  if (!project) throw new Error('Projeto não encontrado.');
  const codProp = projectProposalCode(project);
  if (proposal.codProp !== codProp) {
    throw new Error('A revisão informada não pertence a este projeto.');
  }
  return prisma.$transaction(async (tx) => {
    const budget = await upsertBudget(tx, projectId, proposal);
    await tx.project.update({
      where: { id: projectId },
      data: { commercialProposalCode: String(codProp) }
    });
    return budget;
  });
}

// Dashboard de acompanhamento: projetos cujo contrato bate com propostas importadas, com o
// previsto (orçamento/revisão) e o realizado parcial (nº de RDOs = dias trabalhados, % prazo).
export async function listCommercialDashboard({ categoryCode = null } = {}) {
  // Salários do Omie nunca entram no realizado (serão calculados no app via ponto).
  const categoryWhere = await buildOmieCostCategoryWhere({ categoryCode });
  const realizedWhere = {
    projectId: { not: null },
    ...categoryWhere
  };
  const invoicedWhere = {
    projectId: { not: null },
    valor: { not: null },
    NOT: [{ statusTitulo: 'CANCELADO' }],
    OR: [
      { codigoTipoDocumento: 'NFS' },
      {
        AND: [
          { OR: [{ codigoTipoDocumento: null }, { codigoTipoDocumento: '' }] },
          { numeroDocumentoFiscal: { not: null } },
          { numeroDocumentoFiscal: { not: '' } }
        ]
      }
    ]
  };
  const [proposals, projects, budgets, rdoGroups, omieTotals, omiePaid, omieReceivables] = await Promise.all([
    prisma.commercialProposal.findMany({
      select: {
        codBd: true, codProp: true, nRev: true, salePrice: true, plannedCost: true,
        expectedProfit: true, expectedMargin: true, plannedDays: true, workedDays: true,
        numOperators: true, numSupervisors: true, numPerDay: true, numPerNight: true,
        mobilizationLeadDays: true, serviceModality: true, components: true
      }
    }),
    prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        clientName: true,
        clientCnpj: true,
        contractCode: true,
        commercialProposalCode: true,
        startDate: true,
        isActive: true
      }
    }),
    prisma.projectBudget.findMany({
      where: { version: 1 },
      select: {
        projectId: true, sourceProposalCodBd: true, approvedAt: true, mobilizationLeadDays: true,
        salePrice: true, plannedTotalCost: true, expectedProfit: true, expectedMargin: true, plannedDays: true
      }
    }),
    prisma.report.groupBy({ by: ['projectId'], where: { reportType: 'RDO', deletedAt: null }, _count: { _all: true } }),
    prisma.omiePurchase.groupBy({ by: ['projectId'], where: realizedWhere, _sum: { valor: true } }),
    prisma.omiePurchase.groupBy({ by: ['projectId'], where: { ...realizedWhere, statusTitulo: 'PAGO' }, _sum: { valor: true } }),
    prisma.omieReceivable.findMany({
      where: invoicedWhere,
      select: {
        projectId: true,
        valor: true,
        valorIss: true,
        aliquotaIss: true,
        codigoLc116: true,
        codigoServico: true
      }
    })
  ]);

  const latestByProp = new Map();
  const byCodBd = new Map();
  for (const p of proposals) {
    byCodBd.set(p.codBd, p);
    const cur = latestByProp.get(p.codProp);
    if (!cur || p.nRev > cur.nRev) latestByProp.set(p.codProp, p);
  }
  const budgetByProject = new Map(budgets.map(b => [b.projectId, b]));
  const rdoByProject = new Map(rdoGroups.map(g => [g.projectId, g._count._all]));
  const realizedByProject = new Map(omieTotals.map(g => [g.projectId, g._sum.valor]));
  const realizedPaidByProject = new Map(omiePaid.map(g => [g.projectId, g._sum.valor]));
  const invoicedByProject = new Map();
  for (const receivable of omieReceivables) {
    const amount = toNumber(receivable.valor);
    if (amount === null || amount <= 0) continue;
    const projectId = receivable.projectId;
    const current = invoicedByProject.get(projectId) ?? { total: 0, iss: 0, count: 0, invoices: [] };
    const iss = toNumber(receivable.valorIss);
    current.total += amount;
    current.iss += iss ?? 0;
    current.count += 1;
    current.invoices.push({
      amount,
      iss,
      issRatePct: toNumber(receivable.aliquotaIss),
      serviceTaxCode: receivable.codigoLc116 ?? receivable.codigoServico ?? null
    });
    invoicedByProject.set(projectId, current);
  }

  const rows = [];
  for (const project of projects) {
    const codProp = projectProposalCode(project);
    if (!Number.isInteger(codProp) || !latestByProp.has(codProp)) continue;
    const budget = budgetByProject.get(project.id) || null;
    const resolved = Boolean(project.commercialProposalCode) && Boolean(budget);
    const source = (budget && byCodBd.get(budget.sourceProposalCodBd)) || latestByProp.get(codProp);
    const salePrice = budget?.salePrice ?? source?.salePrice ?? null;
    const invoiced = invoicedByProject.get(project.id) ?? null;
    rows.push({
      projectId: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      clientCnpj: project.clientCnpj,
      proposalCode: String(codProp),
      resolved,
      archived: !project.isActive, // segue o status do projeto nos relatórios (isActive=false => arquivado)
      startDate: project.startDate ?? null,
      approvedAt: budget?.approvedAt ?? null,
      mobilizationLeadDays: budget?.mobilizationLeadDays ?? source?.mobilizationLeadDays ?? null,
      salePrice,
      invoicedRevenue: invoiced?.total ?? null,
      invoicedIss: invoiced?.iss ?? null,
      invoiceCount: invoiced?.count ?? 0,
      presumedProfitTaxes: buildPresumedProfitTaxEstimate(salePrice, {
        components: source?.components ?? null,
        invoices: invoiced?.invoices ?? null,
        invoicedAmount: invoiced?.total ?? null,
        invoiceIss: invoiced?.iss ?? null
      }),
      plannedTotalCost: budget?.plannedTotalCost ?? source?.plannedCost ?? null,
      expectedProfit: budget?.expectedProfit ?? source?.expectedProfit ?? null,
      expectedMargin: budget?.expectedMargin ?? source?.expectedMargin ?? null,
      plannedDays: budget?.plannedDays ?? source?.plannedDays ?? null,
      workedDays: source?.workedDays ?? null,
      numOperators: source?.numOperators ?? null,
      numSupervisors: source?.numSupervisors ?? null,
      numPerDay: source?.numPerDay ?? null,
      numPerNight: source?.numPerNight ?? null,
      serviceModality: source?.serviceModality ?? null,
      components: source?.components ?? {},
      rdoCount: rdoByProject.get(project.id) ?? 0,
      realizedOmieCost: realizedByProject.get(project.id) ?? null,
      realizedCost: realizedByProject.get(project.id) ?? null,
      realizedPaid: realizedPaidByProject.get(project.id) ?? null,
      stockCost: 0,
      progressPct: null,
      progressMethod: null
    });
  }

  if (!categoryCode && rows.length > 0) {
    const stockCosts = await getStockConsumptionCostByProject(rows.map(row => row.projectId));
    applyStockCostsToDashboardRows(rows, stockCosts);
  }

  // Avanço físico (RDO ponderado por serviço; ou manual como fallback) dos projetos exibidos, em lote.
  const progressByProject = await computeProgressForProjects(rows.map(r => r.projectId));
  for (const row of rows) {
    const p = progressByProject.get(row.projectId);
    row.progressPct = p?.progressPct ?? null;
    row.progressMethod = p?.progressMethod ?? null;
    row.progressWeight = progressContributionWeight(p);
  }

  rows.sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.code.localeCompare(b.code));
  return rows;
}

// Projetos cujo contrato bate com alguma proposta importada — sinalização na aba Projetos.
// resolved = já houve escolha de revisão (commercialProposalCode preenchido).
export async function listCommercialPendencias() {
  const grouped = await prisma.commercialProposal.groupBy({
    by: ['codProp'],
    _count: { _all: true }
  });
  if (grouped.length === 0) return [];
  const countByProp = new Map(grouped.map(g => [g.codProp, g._count._all]));

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, contractCode: true, commercialProposalCode: true }
  });

  const result = [];
  for (const project of projects) {
    const codProp = projectProposalCode(project);
    if (!Number.isInteger(codProp) || !countByProp.has(codProp)) continue;
    result.push({
      projectId: project.id,
      proposalCode: String(codProp),
      revisionCount: countByProp.get(codProp),
      resolved: Boolean(project.commercialProposalCode)
    });
  }
  return result;
}

/**
 * Importa o banco comercial Access.
 * @param {object} options
 * @param {Buffer} options.buffer             conteúdo do .accdb
 * @param {string} options.fileName           nome do arquivo enviado
 * @param {string|null} [options.importedByUserId]  usuário (null quando via token de serviço)
 * @param {'SCRIPT'|'MANUAL'} [options.source]
 * @returns {Promise<object>} resumo da importação
 */
export async function importCommercialAccess({ buffer, fileName, importedByUserId = null, source = 'SCRIPT' }) {
  const contentHash = hashBuffer(buffer);

  try {
    // Reenvio idêntico: pula o trabalho (barato), mas grava o recebimento para auditoria/status.
    const duplicate = await prisma.accessImport.findFirst({
      where: { contentHash, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' }
    });
    if (duplicate) {
      let refreshedSelectedProposalFields = 0;
      const receipt = await prisma.$transaction(async (tx) => {
        refreshedSelectedProposalFields = await refreshSelectedProjectBudgetsFromProposals(tx);
        return tx.accessImport.create({
          data: {
            fileName,
            contentHash,
            source,
            status: 'SUCCESS',
            rowsRead: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            pendingProjectsCreated: 0,
            summary: { skippedDuplicate: true, previousImportId: duplicate.id, refreshedSelectedProposalFields },
            importedByUserId
          }
        });
      });
      return { skippedDuplicate: true, contentHash, importId: receipt.id, previousImportId: duplicate.id, refreshedSelectedProposalFields };
    }

    const rawRows = readProposals(buffer);
    const proposals = rawRows
      .map(mapProposalRow)
      .filter(p => Number.isInteger(p.codBd) && Number.isInteger(p.codProp));

    let created = 0;
    let updated = 0;
    let refreshedSelectedProposalFields = 0;
    const importedCodBds = Array.from(new Set(proposals.map(proposal => proposal.codBd)));

    // A importação apenas popula o staging (CommercialProposal). Não cria missões: a maioria das
    // propostas não fecha. A vinculação a um projeto acontece sob demanda, quando já existe uma
    // missão cujo contrato bate (ver listCommercialPendencias / setProjectBudgetRevision).
    const result = await prisma.$transaction(async (tx) => {
      for (const p of proposals) {
        const existing = await tx.commercialProposal.findUnique({ where: { codBd: p.codBd } });
        await tx.commercialProposal.upsert({ where: { codBd: p.codBd }, create: p, update: p });
        if (existing) updated += 1; else created += 1;
      }
      refreshedSelectedProposalFields = await refreshSelectedProjectBudgetsFromProposals(tx, { codBds: importedCodBds });

      return tx.accessImport.create({
        data: {
          fileName,
          contentHash,
          source,
          status: 'SUCCESS',
          rowsRead: rawRows.length,
          created,
          updated,
          skipped: rawRows.length - proposals.length,
          pendingProjectsCreated: 0,
          summary: {
            proposals: proposals.length,
            distinctProposals: new Set(proposals.map(p => p.codProp)).size,
            refreshedSelectedProposalFields
          },
          importedByUserId
        }
      });
    }, { timeout: 120000 });

    return {
      importId: result.id,
      status: result.status,
      rowsRead: rawRows.length,
      created,
      updated,
      refreshedSelectedProposalFields,
      skipped: rawRows.length - proposals.length,
      distinctProposals: new Set(proposals.map(p => p.codProp)).size
    };
  } catch (error) {
    try {
      await prisma.accessImport.create({
        data: {
          fileName,
          contentHash,
          source,
          status: 'ERROR',
          rowsRead: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          pendingProjectsCreated: 0,
          error: error.message,
          summary: { errorName: error.name || null },
          importedByUserId
        }
      });
    } catch (logError) {
      console.warn('[commercial-import] falha ao registrar erro de importação:', logError.message);
    }
    throw error;
  }
}
