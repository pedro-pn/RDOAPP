/*
 * Custo de mão de obra (HH) — módulo Acompanhamento.
 *
 * A partir do ponto importado (PontoPeriodSummary) + motor de custo por cargo, calcula:
 *   - custo/hora de cada colaborador   = custo mensal do motor ÷ horas reais do período
 *   - custo de mão de obra por projeto = Σ (horas do colaborador nos RDOs do projeto × custo/hora)
 *
 * Regras (decididas com o cliente):
 *   - periculosidade é SEMPRE integral (setor operacional) → alimentamos o motor com diasCliente=30,
 *     único consumidor desse campo, deixando as demais verbas intactas;
 *   - transferência (viagem) vem dos dias trabalhados no ponto SEM RDO correspondente;
 *   - produtividade (diasCasa) fica 0 por ora (a calibrar na validação).
 */

import prisma from '../prisma.js';
import { computeMonthlyCost } from './cost-engine.js';
import { getEpiAnnualCost } from './settings.js';

const DIAS_CLIENTE_INTEGRAL = 30; // torna a periculosidade integral no motor de custo
const OFFSHORE_TRANSFERENCIA_BONUS_PCT = 0.10; // +10 pontos percentuais na transferência (projeto offshore)

function dateKeyUTC(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function getLatestPontoImport(importId) {
  if (importId) return prisma.pontoImport.findUnique({ where: { id: importId } });
  return prisma.pontoImport.findFirst({ orderBy: { createdAt: 'desc' } });
}

// Cargo (JobRole.name, que casa com Collaborator.role) -> parâmetros de custo EFETIVOS vigentes.
// "Base viva": o cargo herda os adicionais/percentuais do modelo escolhido (operador/auxiliar) e só
// sobrescreve o que é dele (salário base e insalubridade). Editar o modelo reflete nos cargos.
async function getRoleParamsMap() {
  const [roles, models] = await Promise.all([
    prisma.jobRole.findMany({
      include: { costProfile: { include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } } } }
    }),
    prisma.costProfile.findMany({
      where: { jobRoleId: null },
      include: { parameterSets: { orderBy: { version: 'desc' }, take: 1 } }
    })
  ]);
  const modelParams = new Map(); // key (operador/auxiliar) -> params do modelo
  for (const model of models) {
    const set = model.parameterSets[0];
    if (set) modelParams.set(model.key, set.params);
  }
  const fallbackModel = modelParams.get('operador') || [...modelParams.values()][0] || {};

  const map = new Map();
  for (const role of roles) {
    const set = role.costProfile?.parameterSets?.[0];
    if (!set) continue;
    const override = set.params || {};
    const base = modelParams.get(override.baseModel) || fallbackModel;
    const effective = { ...base };
    if (override.salarioBase != null) effective.salarioBase = override.salarioBase;
    if (override.insalubridade != null) effective.insalubridade = override.insalubridade;
    map.set(role.name, effective);
  }
  return map;
}

// Datas (YYYY-MM-DD) em que cada colaborador aparece em algum RDO no período — separando as datas em
// projetos offshore (que geram transferência/embarque no custo).
async function getRdoDatesByCollaborator(periodStart, periodEndExclusive) {
  const reports = await prisma.report.findMany({
    where: { reportType: 'RDO', deletedAt: null, reportDate: { gte: periodStart, lt: periodEndExclusive } },
    select: {
      reportDate: true,
      project: { select: { offshore: true } },
      collaborators: { select: { collaboratorId: true } }
    }
  });
  const all = new Map();
  const offshore = new Map();
  for (const report of reports) {
    const key = dateKeyUTC(report.reportDate);
    const isOffshore = Boolean(report.project?.offshore);
    for (const link of report.collaborators) {
      if (!all.has(link.collaboratorId)) all.set(link.collaboratorId, new Set());
      all.get(link.collaboratorId).add(key);
      if (isOffshore) {
        if (!offshore.has(link.collaboratorId)) offshore.set(link.collaboratorId, new Set());
        offshore.get(link.collaboratorId).add(key);
      }
    }
  }
  return { all, offshore };
}

function endExclusive(date) {
  return new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000);
}

// custo/hora por colaborador para o ponto vigente (ou o import indicado).
export async function computeCollaboratorRates(importId = null) {
  const pontoImport = await getLatestPontoImport(importId);
  if (!pontoImport) return { pontoImport: null, rates: [], byCollaboratorId: new Map() };

  const periodEndExclusive = endExclusive(pontoImport.periodEnd);
  const [periods, roleParams, rdoDates, epiAnnualCost] = await Promise.all([
    prisma.pontoPeriodSummary.findMany({
      where: { importId: pontoImport.id, collaboratorId: { not: null } },
      include: { collaborator: { select: { id: true, name: true, role: true } } }
    }),
    getRoleParamsMap(),
    getRdoDatesByCollaborator(pontoImport.periodStart, periodEndExclusive),
    getEpiAnnualCost()
  ]);
  const epiMensal = epiAnnualCost / 12; // custo de EPI mensal por colaborador (média fixa)

  const rates = [];
  const byCollaboratorId = new Map();
  for (const period of periods) {
    const role = period.collaborator?.role || null;
    const params = role ? roleParams.get(role) : null;
    const he70Horas = period.he70Minutes / 60;
    const he100Horas = period.he100Minutes / 60;
    const totalHoras = (period.workedMinutes + period.he70Minutes + period.he100Minutes) / 60;
    const collaboratorRdoDates = rdoDates.all.get(period.collaboratorId) || new Set();
    const collaboratorOffshoreDates = rdoDates.offshore.get(period.collaboratorId) || new Set();
    // Viagem: dias trabalhados no ponto sem RDO. Offshore: dias com RDO em projeto offshore.
    const diasFora = period.workedDates.filter(date => !collaboratorRdoDates.has(date)).length;
    const offshoreDays = period.workedDates.filter(date => collaboratorOffshoreDates.has(date)).length;

    // Calculamos dois custos: base (sem o adicional offshore) e com offshore, para o cliente comparar.
    let totalMensal = null;
    let custoHora = null;
    let totalMensalBase = null;
    let custoHoraBase = null;
    if (params) {
      const baseInputs = { diasCliente: DIAS_CLIENTE_INTEGRAL, diasFora, diasCasa: 0, he70Horas, he100Horas };
      const costBase = computeMonthlyCost(params, baseInputs); // offshoreDays default 0 → sem adicional
      const cost = computeMonthlyCost(params, {
        ...baseInputs,
        offshoreDays,
        offshoreBonusPct: OFFSHORE_TRANSFERENCIA_BONUS_PCT
      });
      // EPI é uma média fixa por colaborador, independente de cargo/offshore → entra nos dois totais.
      totalMensalBase = costBase.totalMensal + epiMensal;
      totalMensal = cost.totalMensal + epiMensal;
      custoHoraBase = totalHoras > 0 ? totalMensalBase / totalHoras : 0;
      custoHora = totalHoras > 0 ? totalMensal / totalHoras : 0;
    }

    const entry = {
      collaboratorId: period.collaboratorId,
      name: period.collaborator?.name || period.rawName,
      role,
      hasCostProfile: Boolean(params),
      totalHoras,
      he70Horas,
      he100Horas,
      diasFora,
      offshoreDays,
      totalMensalBase,
      totalMensal,
      custoHoraBase,
      custoHora
    };
    rates.push(entry);
    byCollaboratorId.set(period.collaboratorId, entry);
  }
  return { pontoImport, rates, byCollaboratorId };
}

// Custo de mão de obra por projeto (mapa projectId -> { laborCost, hours }).
export async function laborCostByProject(importId = null) {
  const { pontoImport, byCollaboratorId } = await computeCollaboratorRates(importId);
  if (!pontoImport) return { pontoImport: null, periodStart: null, periodEnd: null, byProjectId: new Map() };

  const periodEndExclusive = endExclusive(pontoImport.periodEnd);
  const reports = await prisma.report.findMany({
    where: { reportType: 'RDO', deletedAt: null, reportDate: { gte: pontoImport.periodStart, lt: periodEndExclusive } },
    select: {
      projectId: true,
      daytimeWorkedMinutes: true,
      nighttimeWorkedMinutes: true,
      collaborators: { select: { collaboratorId: true } }
    }
  });

  const byProjectId = new Map();
  for (const report of reports) {
    const workedHours = (report.daytimeWorkedMinutes + report.nighttimeWorkedMinutes) / 60;
    if (workedHours <= 0) continue;
    let agg = byProjectId.get(report.projectId);
    if (!agg) { agg = { laborCost: 0, laborCostBase: 0, hours: 0, hasRate: false }; byProjectId.set(report.projectId, agg); }
    for (const link of report.collaborators) {
      const rate = byCollaboratorId.get(link.collaboratorId);
      agg.hours += workedHours;
      if (rate && rate.custoHora != null) {
        agg.laborCost += workedHours * rate.custoHora;
        agg.laborCostBase += workedHours * (rate.custoHoraBase ?? rate.custoHora);
        agg.hasRate = true;
      }
    }
  }
  return { pontoImport, periodStart: pontoImport.periodStart, periodEnd: pontoImport.periodEnd, byProjectId };
}
