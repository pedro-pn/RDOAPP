/*
 * Dashboard de um projeto (módulo Acompanhamento). Cruza previsto (comercial + escopo manual) com o
 * realizado dos RDOs e das compras do Omie, para a tela de detalhe aberta ao clicar num card.
 *
 * Regras do cliente:
 *  - Gasto = TOTAL (pago + a pagar) dos títulos do Omie do projeto.
 *  - Excluir custos de salário/mão de obra (serão calculados no app via VR): filtramos categorias
 *    cuja descrição contém palavras-chave de folha (salário, INSS, FGTS, férias, 13º, rescisão...).
 *  - Standby cobrindo a jornada cheia do dia = dia "parado".
 */

import { listCommercialDashboard } from './access-import.js';
import { computeAlerts } from './alerts.js';
import { buildOmieCostCategoryWhere } from './cost-categories.js';
import { getEquipmentUsageByProject } from './equipment-usage.js';
import { laborCostByProject } from './labor-cost.js';
import { buildWorkedHoursProgress } from './project-cards.js';
import { computeProgressHistoryForProjects } from './avanco.js';
import {
  nightCollaboratorIdsFromReport,
  nightCollaboratorSnapshotsFromReport,
  reportPersonTimeMetrics,
  reportWorkedMinutesByCollaborator
} from './report-time.js';
import { isSalaryCategory } from './salary.js';
import { getStockConsumptionCostByProject } from './stock-cost.js';
import prisma from '../prisma.js';

function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseMinutes(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':');
  if (parts.length >= 2) return parseInt(parts[0], 10) * 60 + (parseInt(parts[1], 10) || 0);
  return 0;
}

function journeyMinutes(project, reportDate) {
  const day = new Date(reportDate).getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const hours = isWeekend ? (project?.weekendWorkdayHours || project?.workdayHours) : project?.workdayHours;
  return parseMinutes(hours);
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function diffCalendarDays(from, to) {
  const a = new Date(from); const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function addCalendarDays(startDate, days) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString();
}

function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function plannedRoleName(item) {
  return item.roleName || item.jobRole?.name || null;
}

function addRoleWork(collaboratorIdsByRole, workedHoursByRole, collaboratorId, role, workedMinutes) {
  const roleKey = normalizeRole(role);
  if (!roleKey || !collaboratorId) return;
  if (!collaboratorIdsByRole.has(roleKey)) collaboratorIdsByRole.set(roleKey, new Set());
  collaboratorIdsByRole.get(roleKey).add(collaboratorId);
  workedHoursByRole.set(roleKey, (workedHoursByRole.get(roleKey) || 0) + (workedMinutes / 60));
}

function nightCollaboratorRole(report, collaboratorId, index, roleByCollaboratorId) {
  const noturnoDetails = report?.specialConditions?.noturnoDetails || {};
  const snapshots = Array.isArray(noturnoDetails.colaboradores) ? noturnoDetails.colaboradores : [];
  const snapshot = snapshots.find(item => item?.id === collaboratorId) || snapshots[index];
  return snapshot && typeof snapshot === 'object'
    ? snapshot.role || roleByCollaboratorId.get(collaboratorId)
    : roleByCollaboratorId.get(collaboratorId);
}

export function buildPlannedRoleCounts(plannedRows = [], collaborators = [], plannedTotalHours = 0, reports = null) {
  const collaboratorIdsByRole = new Map();
  const workedHoursByRole = new Map();
  const roleByCollaboratorId = new Map();
  const useTurnAwareReports = Array.isArray(reports);
  for (const c of collaborators) {
    if (c.collaboratorId && c.collaborator?.role) roleByCollaboratorId.set(c.collaboratorId, c.collaborator.role);
    const workedMinutes = (c.report?.daytimeWorkedMinutes || 0) + (useTurnAwareReports ? 0 : c.report?.nighttimeWorkedMinutes || 0);
    addRoleWork(collaboratorIdsByRole, workedHoursByRole, c.collaboratorId, c.collaborator?.role, workedMinutes);
  }

  if (useTurnAwareReports) {
    for (const report of reports) {
      const nightWorkedMinutes = report?.nighttimeWorkedMinutes || 0;
      if (nightWorkedMinutes <= 0) continue;
      nightCollaboratorIdsFromReport(report).forEach((collaboratorId, index) => {
        addRoleWork(
          collaboratorIdsByRole,
          workedHoursByRole,
          collaboratorId,
          nightCollaboratorRole(report, collaboratorId, index, roleByCollaboratorId),
          nightWorkedMinutes
        );
      });
    }
  }

  const plannedRoles = new Map();
  for (const row of plannedRows) {
    const label = plannedRoleName(row);
    const roleKey = normalizeRole(label);
    if (roleKey && !plannedRoles.has(roleKey)) plannedRoles.set(roleKey, label);
  }

  return [...plannedRoles.entries()]
    .map(([roleKey, roleName]) => ({
      roleName,
      collaboratorCount: collaboratorIdsByRole.get(roleKey)?.size ?? 0,
      usedHours: Math.round((workedHoursByRole.get(roleKey) || 0) * 10) / 10
    }))
    .map(item => ({
      ...item,
      pctOfPlannedTotal: plannedTotalHours > 0 ? Math.round((item.usedHours / plannedTotalHours) * 100) : null
    }))
    .filter(item => item.collaboratorCount > 0)
    .sort((a, b) => a.roleName.localeCompare(b.roleName, 'pt-BR'));
}

function isPaidTitle(status) {
  return String(status || '').trim().toUpperCase() === 'PAGO';
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function minutesToHours(minutes) {
  return Math.round((Math.max(0, minutes) / 60) * 10) / 10;
}

export function buildOmieCostPaymentSummary(groups = []) {
  let paid = 0;
  let pending = 0;

  for (const group of groups) {
    if (isSalaryCategory(group.categoriaDescricao || group.categoriaCodigo)) continue;
    const value = toNum(group._sum?.valor) ?? 0;
    if (value <= 0) continue;
    if (isPaidTitle(group.statusTitulo)) paid += value;
    else pending += value;
  }

  return {
    pago: roundMoney(paid),
    previstoPagar: roundMoney(pending)
  };
}

// Status do dia a partir do standby agregado vs jornada cheia.
function dayStatus(standbyMin, journeyMin) {
  if (standbyMin > 0 && journeyMin > 0 && standbyMin >= journeyMin) return 'PARADO';
  if (standbyMin > 0) return 'STANDBY';
  return 'TRABALHADO';
}

export async function getProjectDetail(projectId, { includeCollaboratorCosts = false } = {}) {
  const rows = await listCommercialDashboard();
  const row = rows.find(r => r.projectId === projectId);
  if (!row) throw new Error('Projeto não encontrado no acompanhamento comercial.');
  const categoryWhere = await buildOmieCostCategoryWhere();

  const [
    project,
    reports,
    collaborators,
    costGroups,
    costStatusGroups,
    labor,
    equipmentByProject,
    stockCosts,
    plannedNormalHours,
    plannedOvertime,
    progressHistoryByProject
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { clientSegment: true, mobilizationDate: true, workdayHours: true, weekendWorkdayHours: true }
    }),
    prisma.report.findMany({
      where: { projectId, reportType: 'RDO', deletedAt: null },
      select: {
        id: true,
        reportDate: true, specialConditions: true, totalOvertimeMinutes: true,
        daytimeCount: true,
        daytimeWorkedMinutes: true, nighttimeWorkedMinutes: true,
        daytimeOvertimeMinutes: true, nighttimeOvertimeMinutes: true
      },
      orderBy: { reportDate: 'asc' }
    }),
    prisma.reportCollaborator.findMany({
      where: { report: { projectId, reportType: 'RDO', deletedAt: null } },
      select: {
        reportId: true,
        collaboratorId: true,
        collaborator: { select: { name: true, role: true } },
        report: { select: { daytimeWorkedMinutes: true, nighttimeWorkedMinutes: true } }
      }
    }),
    prisma.omiePurchase.groupBy({
      by: ['categoriaCodigo', 'categoriaDescricao'],
      where: { projectId, ...categoryWhere },
      _sum: { valor: true }
    }),
    prisma.omiePurchase.groupBy({
      by: ['statusTitulo', 'categoriaCodigo', 'categoriaDescricao'],
      where: { projectId, ...categoryWhere },
      _sum: { valor: true }
    }),
    laborCostByProject(), // custo de mão de obra (HH) do ponto vigente
    getEquipmentUsageByProject([projectId]),
    getStockConsumptionCostByProject([projectId]),
    prisma.projectPlannedNormalHours.findMany({
      where: { projectId },
      select: { hours: true, roleName: true, jobRole: { select: { name: true } } }
    }),
    prisma.projectPlannedOvertime.findMany({
      where: { projectId },
      select: { hours: true, roleName: true, jobRole: { select: { name: true } } }
    }),
    computeProgressHistoryForProjects([projectId])
  ]);

  // Mão de obra (HH) do ponto — mantido SEPARADO do gasto Omie (em validação, não somado).
  const laborAgg = labor.byProjectId.get(projectId) || null;
  const maoDeObra = {
    custo: laborAgg?.laborCost ?? null, // com adicional offshore
    custoBase: laborAgg?.laborCostBase ?? null, // sem offshore
    horas: laborAgg?.hours ?? null,
    periodStart: labor.periodStart ?? null,
    periodEnd: labor.periodEnd ?? null
  };

  // --- Custos (Omie), excluindo salários ---
  const nonSalary = costGroups
    .filter(g => !isSalaryCategory(g.categoriaDescricao || g.categoriaCodigo))
    .map(g => ({
      categoria: g.categoriaDescricao || g.categoriaCodigo || 'Sem categoria',
      total: toNum(g._sum.valor) ?? 0
    }))
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total);
  const omieGasto = nonSalary.reduce((sum, g) => sum + g.total, 0);
  const omiePayment = buildOmieCostPaymentSummary(costStatusGroups);
  const stockCost = stockCosts.get(projectId) || { total: 0, categories: [] };
  const gasto = omieGasto + stockCost.total;
  const previstoCusto = toNum(row.plannedTotalCost);
  const maioresGastos = [...nonSalary, ...stockCost.categories]
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, 'pt-BR'))
    .slice(0, 5);

  // --- Agregação dos RDOs (por dia) ---
  const dayCollaboratorIdsByReport = new Map();
  for (const c of collaborators) {
    if (!dayCollaboratorIdsByReport.has(c.reportId)) dayCollaboratorIdsByReport.set(c.reportId, []);
    dayCollaboratorIdsByReport.get(c.reportId).push(c.collaboratorId);
  }

  const byDay = new Map(); // dateKey -> { standbyMin, statusStandbyMin, workedMin, overtimeMin, reportDate }
  let standbyCount = 0;
  let standbyMinutesTotal = 0;
  let overtimeMinutesTotal = 0;
  let normalWorkedMinutesTotal = 0;
  let overtimeWorkedMinutesTotal = 0;
  let lastRdoDate = null;
  const workedMinutesByCollaborator = new Map();

  for (const r of reports) {
    const key = dateKey(r.reportDate);
    if (!lastRdoDate || new Date(r.reportDate) > new Date(lastRdoDate)) lastRdoDate = r.reportDate;
    const sc = r.specialConditions || {};
    const dayCollaboratorIds = dayCollaboratorIdsByReport.get(r.id) || [];
    const metrics = reportPersonTimeMetrics(r, dayCollaboratorIds);
    const standbyMin = metrics.standbyDurationMinutes;
    if (sc.standby === true) standbyCount += 1;
    standbyMinutesTotal += metrics.standbyPersonMinutes;
    overtimeMinutesTotal += metrics.overtimeWorkedMinutes;
    normalWorkedMinutesTotal += metrics.normalWorkedMinutes;
    overtimeWorkedMinutesTotal += metrics.overtimeWorkedMinutes;
    for (const [collaboratorId, minutes] of reportWorkedMinutesByCollaborator(r, dayCollaboratorIds)) {
      workedMinutesByCollaborator.set(collaboratorId, (workedMinutesByCollaborator.get(collaboratorId) || 0) + minutes);
    }

    const acc = byDay.get(key) || { standbyMin: 0, statusStandbyMin: 0, workedMin: 0, overtimeMin: 0, reportDate: r.reportDate };
    acc.standbyMin += metrics.standbyPersonMinutes;
    acc.statusStandbyMin += standbyMin;
    acc.workedMin += metrics.normalWorkedMinutes + metrics.overtimeWorkedMinutes;
    acc.overtimeMin += metrics.overtimeWorkedMinutes;
    byDay.set(key, acc);
  }

  const workedDays = byDay.size;

  // Últimos 5 dias (cronológico) com status para a régua de bolinhas.
  const ultimosDias = [...byDay.entries()]
    .sort((a, b) => new Date(a[1].reportDate) - new Date(b[1].reportDate))
    .slice(-5)
    .map(([key, d]) => ({
      date: key,
      status: dayStatus(d.statusStandbyMin, journeyMinutes(project, d.reportDate)),
      workedMinutes: d.workedMin,
      standbyMinutes: d.standbyMin
    }));

  // --- Colaboradores distintos (nome + cargo + custo/hora do ponto vigente) ---
  const ratesById = labor.byCollaboratorId || new Map();
  const collabMap = new Map();
  const ensureCollaborator = (collaboratorId, { name = '', role = '' } = {}) => {
    if (!collaboratorId || collabMap.has(collaboratorId)) return;
    const rate = ratesById.get(collaboratorId) || null;
    const alloc = rate?.byProject?.[projectId] || null;
    // Valor gasto com o colaborador NESTA obra (rateado) e o custo/hora dele na obra.
    const custo = alloc?.cost ?? null;
    const custoHora = alloc && alloc.hours > 0 ? alloc.cost / alloc.hours : null;
    collabMap.set(collaboratorId, {
      name: name || rate?.name || '—',
      role: role || rate?.role || '—',
      horas: minutesToHours(workedMinutesByCollaborator.get(collaboratorId) || 0),
      // Custo é dado sensível (salário): só para gestores.
      custo: includeCollaboratorCosts ? custo : null,
      custoHora: includeCollaboratorCosts ? custoHora : null
    });
  };
  for (const c of collaborators) {
    ensureCollaborator(c.collaboratorId, {
      name: c.collaborator?.name || '',
      role: c.collaborator?.role || ''
    });
  }
  for (const report of reports) {
    for (const snapshot of nightCollaboratorSnapshotsFromReport(report)) {
      ensureCollaborator(snapshot.id, snapshot);
    }
    for (const collaboratorId of nightCollaboratorIdsFromReport(report)) {
      ensureCollaborator(collaboratorId);
    }
  }
  for (const collaboratorId of workedMinutesByCollaborator.keys()) {
    ensureCollaborator(collaboratorId);
  }
  const colaboradores = [...collabMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // --- Prazos / dias ---
  const plannedDays = toNum(row.plannedDays);
  const plannedWorkedDays = toNum(row.workedDays) ?? plannedDays;
  const today = new Date();

  // --- Equipamentos em obra (módulo Equipamentos), mesma lógica do card de projetos ---
  const projectReferenceDate = row.archived && lastRdoDate ? new Date(lastRdoDate) : today;
  const equipmentEndDate = projectReferenceDate;
  const equipamentos = (equipmentByProject.get(projectId) || [])
    .map(e => {
      const since = new Date(e.sinceDate);
      const days = Math.max(0, Math.round((equipmentEndDate.getTime() - since.getTime()) / 86400000));
      return { name: e.name, days, since: e.sinceDate };
    })
    .sort((a, b) => b.days - a.days);

  const elapsedCorridos = row.startDate ? Math.max(0, diffCalendarDays(row.startDate, projectReferenceDate) ?? 0) : null;
  const diasCorridos = {
    elapsed: elapsedCorridos,
    planned: plannedDays,
    pct: elapsedCorridos != null && plannedDays ? Math.round((elapsedCorridos / plannedDays) * 100) : null
  };
  const diasTrabalhados = {
    worked: workedDays,
    planned: plannedWorkedDays,
    pct: plannedWorkedDays ? Math.round((workedDays / plannedWorkedDays) * 100) : null
  };
  const plannedNormalHoursTotal = plannedNormalHours.reduce((sum, item) => sum + (toNum(item.hours) ?? 0), 0);
  const plannedOvertimeHoursTotal = plannedOvertime.reduce((sum, item) => sum + (toNum(item.hours) ?? 0), 0);
  const workedHours = buildWorkedHoursProgress({
    normalWorkedMinutes: normalWorkedMinutesTotal,
    overtimeWorkedMinutes: overtimeWorkedMinutesTotal,
    plannedNormalHours: plannedNormalHoursTotal,
    plannedOvertimeHours: plannedOvertimeHoursTotal
  });
  workedHours.roleCounts = buildPlannedRoleCounts(
    [...plannedNormalHours, ...plannedOvertime],
    collaborators,
    workedHours.plannedTotalHours ?? 0,
    reports
  );

  const expectedEndDate = row.startDate && plannedDays ? addCalendarDays(row.startDate, plannedDays) : null;
  const avancoPct = row.progressPct ?? null;
  const projectedEndByPace = (row.startDate && elapsedCorridos && elapsedCorridos > 0 && avancoPct && avancoPct > 0)
    ? addCalendarDays(row.startDate, elapsedCorridos * (100 / avancoPct))
    : null;

  const alerts = computeAlerts({
    startDate: row.startDate ?? null,
    plannedDays,
    gasto: gasto + (maoDeObra.custo ?? 0), // realizado total = compras Omie + mão de obra
    plannedCost: previstoCusto,
    lastRdoDate,
    lastDayStatus: ultimosDias.length ? ultimosDias[ultimosDias.length - 1].status : null,
    progressPct: avancoPct,
    now: projectReferenceDate
  });

  return {
    header: {
      code: row.code,
      clientName: row.clientName,
      clientCnpj: row.clientCnpj ?? null,
      proposalCode: row.proposalCode,
      lastRdoDate,
      segment: project?.clientSegment ?? null
    },
    alerts,
    diasCorridos,
    diasTrabalhados,
    consumo: {
      gasto,
      omie: omieGasto,
      pago: omiePayment.pago,
      previstoPagar: omiePayment.previstoPagar,
      estoque: stockCost.total,
      previsto: previstoCusto,
      pct: previstoCusto && previstoCusto > 0 ? Math.round((gasto / previstoCusto) * 100) : null
    },
    faturamento: {
      previsto: row.salePrice ?? null,
      realizado: row.invoicedRevenue ?? null,
      notas: row.invoiceCount ?? 0
    },
    presumedProfitTaxes: row.presumedProfitTaxes ?? null,
    maoDeObra,
    workedHours,
    maioresGastos,
    avancoPct,
    avancoMethod: row.progressMethod ?? null,
    progressHistory: progressHistoryByProject.get(projectId) ?? [],
    standby: { count: standbyCount, minutes: standbyMinutesTotal },
    ultimosDias,
    overtimeMinutes: overtimeMinutesTotal,
    colaboradores,
    equipamentos,
    footer: {
      mobilizationDate: project?.mobilizationDate ?? null,
      startDate: row.startDate ?? null,
      expectedEndDate,
      projectedEndByPace
    }
  };
}
