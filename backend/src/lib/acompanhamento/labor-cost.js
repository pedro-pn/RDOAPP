/*
 * Custo de mão de obra — módulo Acompanhamento (modelo revisado 2026-07-08, das planilhas do motor).
 *
 * DIVISÃO MENSAL: o custo é calculado por mês-calendário (o salário mensal sai uma vez por mês). Mês
 * parcial (arquivo cobre só parte do mês) tem os custos FIXOS proporcionais aos dias cobertos.
 *
 * FOLHA (custo mensal do colaborador, por mês):
 *  - dias trabalhados = horas normais do ponto ÷ 8,8 (HORAS_POR_DIA).
 *  - diasCliente (periculosidade) = dias COM projeto (RDO). Em projeto não-offshore, a configuração
 *    manual por colaborador define se o dia entra como diasFora (dorme fora) ou diasCasa (dorme em
 *    casa/gratificação). Dia com ponto e sem RDO não alimenta verbas variáveis.
 *  - Dia de semana sem ponto = folga: 8,8h zerados (só no denominador do HH).
 *  - HH = folha ÷ (horas do ponto + horas de folga).
 *
 * CUSTO POR PROJETO: recalcula o motor com as horas de RDO do projeto para os adicionais/HE
 * (composição), e rateia o FIXO (base do motor sem dias + EPI, proporcional no mês
 * parcial) pelas horas. SOBRA = folha − Σ projetos, quebrada em SEDE (ponto batido não alocado) e
 * FOLGA (dia de semana sem ponto). Prova real: Σ projetos + sede + folga = folha.
 */

import prisma from '../prisma.js';
import { computeMonthlyCost } from './cost-engine.js';
import { getEpiAnnualCost } from './settings.js';

const HORAS_POR_DIA = 8.8;
const OFFSHORE_TRANSFERENCIA_BONUS_PCT = 0.10; // +10 pontos percentuais na transferência (offshore)

function dateKeyUTC(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function endExclusive(date) {
  return new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000);
}

function sleepModeFor(project, collaboratorId) {
  const map = project?.laborSleepModeByCollaborator;
  if (map && typeof map === 'object' && !Array.isArray(map) && map[collaboratorId] === 'HOME') return 'HOME';
  return 'AWAY';
}

function projectHours(p) {
  const rdoDaysHours = p.rdoDaysHours || 0;
  const explicitSleepHours = p.awayDaysHours != null || p.homeDaysHours != null || p.offshoreDaysHours != null;
  if (!explicitSleepHours) {
    return {
      clientHours: rdoDaysHours,
      awayHours: p.offshore ? 0 : rdoDaysHours,
      homeHours: 0,
      offshoreHours: p.offshore ? rdoDaysHours : 0
    };
  }
  const awayHours = p.awayDaysHours || 0;
  const homeHours = p.homeDaysHours || 0;
  const offshoreHours = p.offshoreDaysHours || 0;
  return {
    clientHours: rdoDaysHours || awayHours + homeHours + offshoreHours,
    awayHours,
    homeHours,
    offshoreHours
  };
}

// Dias de semana (seg–sex) no intervalo que não estão no ponto = folga.
function countFolgaWeekdays(rangeStart, rangeEnd, workedDatesSet) {
  let count = 0;
  const end = new Date(rangeEnd);
  for (const d = new Date(rangeStart); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay(); // 0=dom, 6=sáb
    if (dow >= 1 && dow <= 5 && !workedDatesSet.has(d.toISOString().slice(0, 10))) count += 1;
  }
  return count;
}

function totalCost(params, inputs, epiMensal) {
  return computeMonthlyCost(params, inputs).totalMensal + epiMensal;
}

async function getLatestPontoImport(importId) {
  if (importId) return prisma.pontoImport.findUnique({ where: { id: importId } });
  return prisma.pontoImport.findFirst({ orderBy: { createdAt: 'desc' } });
}

// Cargo (JobRole.name = Collaborator.role) -> parâmetros efetivos ("base viva": herda do modelo,
// sobrescreve salário base + insalubridade).
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
  const modelParams = new Map();
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

// RDO por colaborador: por projeto (offshore) e o projeto/horas de cada dia.
async function getRdoDataByCollaborator(periodStart, periodEndExclusive) {
  const reports = await prisma.report.findMany({
    where: { reportType: 'RDO', deletedAt: null, reportDate: { gte: periodStart, lt: periodEndExclusive } },
    select: {
      projectId: true,
      reportDate: true,
      daytimeWorkedMinutes: true,
      nighttimeWorkedMinutes: true,
      project: { select: { offshore: true, laborSleepModeByCollaborator: true } },
      collaborators: { select: { collaboratorId: true } }
    }
  });
  const map = new Map();
  for (const report of reports) {
    const dk = dateKeyUTC(report.reportDate);
    const workedHours = (report.daytimeWorkedMinutes + report.nighttimeWorkedMinutes) / 60;
    const offshore = Boolean(report.project?.offshore);
    for (const link of report.collaborators) {
      const sleepMode = sleepModeFor(report.project, link.collaboratorId);
      let c = map.get(link.collaboratorId);
      if (!c) { c = { byProject: new Map(), dayProject: new Map() }; map.set(link.collaboratorId, c); }
      let p = c.byProject.get(report.projectId);
      if (!p) { p = { offshore, sleepMode }; c.byProject.set(report.projectId, p); }
      const existing = c.dayProject.get(dk);
      if (!existing || workedHours > existing.hours) {
        c.dayProject.set(dk, { projectId: report.projectId, hours: workedHours, offshore, sleepMode });
      }
    }
  }
  return map;
}

// Classifica só dias com RDO. Dia com ponto e sem RDO fica como sede/sobra, sem verbas variáveis.
function classifyDays(workedDates, rdo) {
  const projAwayDays = new Map();
  const projHomeDays = new Map();
  const projOffshoreDays = new Map();
  for (const d of workedDates) {
    const dp = rdo.dayProject.get(d);
    if (!dp) continue;
    if (dp.offshore) {
      projOffshoreDays.set(dp.projectId, (projOffshoreDays.get(dp.projectId) || 0) + 1);
    } else if (dp.sleepMode === 'HOME') {
      projHomeDays.set(dp.projectId, (projHomeDays.get(dp.projectId) || 0) + 1);
    } else {
      projAwayDays.set(dp.projectId, (projAwayDays.get(dp.projectId) || 0) + 1);
    }
  }
  return { projAwayDays, projHomeDays, projOffshoreDays };
}

// Fração do mês coberta pelo arquivo (para proporcionalizar o fixo no mês parcial).
function monthCoverage(monthKey, fileStart, fileEnd) {
  const [y, m] = monthKey.split('-').map(Number);
  const monthStart = Date.UTC(y, m - 1, 1);
  const monthEndDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = Date.UTC(y, m - 1, monthEndDay);
  const start = Math.max(monthStart, new Date(fileStart).getTime());
  const end = Math.min(monthEnd, new Date(fileEnd).getTime());
  const coverDays = Math.max(0, Math.round((end - start) / 86400000) + 1);
  return { fraction: Math.min(1, coverDays / monthEndDay), start: new Date(start), end: new Date(end) };
}

// Divide a hora extra do mês em 70% e 100% com teto de HE70 (padrão 30h/mês): o excesso vira 100%.
export function splitOvertime(extrasHoras, cap = 30) {
  const he70Horas = Math.min(cap, Math.max(0, extrasHoras));
  const he100Horas = Math.max(0, extrasHoras - cap);
  return { he70Horas, he100Horas };
}

// Detalhe por mês do colaborador: usa o `monthly` do ponto (exato, com teto de HE por mês); se ausente
// (imports antigos), apropria os totais do período pela proporção de dias trabalhados.
function monthsOf(period, cap) {
  if (period.monthly && typeof period.monthly === 'object' && Object.keys(period.monthly).length) {
    return Object.entries(period.monthly).map(([monthKey, m]) => ({
      monthKey,
      normalHours: (m.normalMinutes || 0) / 60,
      workedDates: m.workedDates || [],
      ...splitOvertime((m.extrasMinutes || 0) / 60, cap)
    }));
  }
  const workedDates = period.workedDates || [];
  const total = workedDates.length || 1;
  const byMonth = new Map();
  for (const d of workedDates) { const mk = d.slice(0, 7); if (!byMonth.has(mk)) byMonth.set(mk, []); byMonth.get(mk).push(d); }
  return [...byMonth.entries()].map(([monthKey, dates]) => {
    const ratio = dates.length / total;
    return {
      monthKey,
      normalHours: (period.workedMinutes / 60) * ratio,
      workedDates: dates,
      he70Horas: (period.he70Minutes / 60) * ratio,
      he100Horas: (period.he100Minutes / 60) * ratio
    };
  });
}

/*
 * Função pura (testável): folha + custo por projeto + sobra (sede/folga) de um colaborador num mês.
 *   projects: [{ pid, rdoDaysHours, awayDaysHours, homeDaysHours, offshoreDaysHours, rdoWorkedHours, offshore }]
 *   fixedCoverage: fração do mês coberta (1 = mês cheio; <1 no mês parcial → fixo proporcional).
 * Garante: Σ projetos + sede + folga = folha.
 */
export function computeCollaboratorCost({ params, epiMensal, normalHours, he70Horas, he100Horas, folgaHours, projects, fixedCoverage = 1 }) {
  const dpd = HORAS_POR_DIA;
  const hourGroups = projects.map(projectHours);
  const projectDaysHours = hourGroups.reduce((s, p) => s + p.clientHours, 0);
  const awayDaysHours = hourGroups.reduce((s, p) => s + p.awayHours, 0);
  const homeDaysHours = hourGroups.reduce((s, p) => s + p.homeHours, 0);
  const offshoreDaysHours = hourGroups.reduce((s, p) => s + p.offshoreHours, 0);
  const totalRdoWorked = projects.reduce((s, p) => s + p.rdoWorkedHours, 0);
  const totalHours = normalHours + he70Horas + he100Horas + folgaHours;

  const folhaInputs = {
    diasCliente: projectDaysHours / dpd,
    diasFora: awayDaysHours / dpd,
    offshoreDays: offshoreDaysHours / dpd,
    offshoreBonusPct: OFFSHORE_TRANSFERENCIA_BONUS_PCT,
    diasCasa: homeDaysHours / dpd,
    he70Horas,
    he100Horas
  };
  const fixedBaseFull = totalCost(params, {}, epiMensal); // base + encargos + benefícios + EPI (mês cheio)
  const fixedBase = fixedBaseFull * fixedCoverage;         // proporcional no mês parcial
  const variavelMensal = totalCost(params, folhaInputs, epiMensal) - fixedBaseFull;
  const variavelMensalBase = totalCost(params, { ...folhaInputs, diasFora: (awayDaysHours + offshoreDaysHours) / dpd, offshoreDays: 0 }, epiMensal) - fixedBaseFull;
  const folha = fixedBase + variavelMensal;
  const folhaBase = fixedBase + variavelMensalBase;

  const zeroNoEpi = computeMonthlyCost(params, {}).totalMensal; // base do incremento variável por obra
  const byProject = {};
  let sumCost = 0;
  let sumCostBase = 0;
  let sumProjectHours = 0;
  for (const p of projects) {
    const he70P = totalRdoWorked > 0 ? he70Horas * (p.rdoWorkedHours / totalRdoWorked) : 0;
    const he100P = totalRdoWorked > 0 ? he100Horas * (p.rdoWorkedHours / totalRdoWorked) : 0;
    const hours = projectHours(p);
    const projectHoursTotal = hours.clientHours;
    const inputsP = {
      diasCliente: hours.clientHours / dpd,
      diasFora: hours.awayHours / dpd,
      offshoreDays: hours.offshoreHours / dpd,
      offshoreBonusPct: OFFSHORE_TRANSFERENCIA_BONUS_PCT,
      diasCasa: hours.homeHours / dpd,
      he70Horas: he70P,
      he100Horas: he100P
    };
    const variavelP = computeMonthlyCost(params, inputsP).totalMensal - zeroNoEpi;
    const variavelPBase = computeMonthlyCost(params, { ...inputsP, diasFora: (hours.awayHours + hours.offshoreHours) / dpd, offshoreDays: 0 }).totalMensal - zeroNoEpi;
    const hoursForProration = projectHoursTotal + he70P + he100P;
    const fixoP = totalHours > 0 ? fixedBase * (hoursForProration / totalHours) : 0;
    byProject[p.pid] = { cost: fixoP + variavelP, costBase: fixoP + variavelPBase, hours: hoursForProration };
    sumCost += fixoP + variavelP;
    sumCostBase += fixoP + variavelPBase;
    sumProjectHours += hoursForProration;
  }

  // Sobra = folha − Σ projetos, quebrada em folga (dias de semana sem ponto) e sede (o resto).
  const idleHours = Math.max(0, totalHours - sumProjectHours);
  const idleCost = folha - sumCost;
  const idleCostBase = folhaBase - sumCostBase;
  const folgaH = Math.min(folgaHours, idleHours);
  const sedeH = Math.max(0, idleHours - folgaH);
  const sedeFrac = idleHours > 0 ? sedeH / idleHours : 0;
  const idle = {
    sede: { cost: idleCost * sedeFrac, costBase: idleCostBase * sedeFrac, hours: sedeH },
    folga: { cost: idleCost * (1 - sedeFrac), costBase: idleCostBase * (1 - sedeFrac), hours: folgaH }
  };

  return {
    folha,
    folhaBase,
    fixoMensal: fixedBase,
    variavelMensal,
    totalHours,
    byProject,
    idle
  };
}

// Custo/hora e rateio por obra de cada colaborador para o ponto vigente (ou o import indicado),
// somando a divisão mensal.
export async function computeCollaboratorRates(importId = null) {
  const pontoImport = await getLatestPontoImport(importId);
  if (!pontoImport) return { pontoImport: null, rates: [], byCollaboratorId: new Map() };

  const periodEndExclusive = endExclusive(pontoImport.periodEnd);
  const fileStart = pontoImport.periodStart;
  const fileEnd = pontoImport.periodEnd;
  const [periods, roleParams, rdoData, epiAnnualCost] = await Promise.all([
    prisma.pontoPeriodSummary.findMany({
      where: { importId: pontoImport.id, collaboratorId: { not: null } },
      include: { collaborator: { select: { id: true, name: true, role: true } } }
    }),
    getRoleParamsMap(),
    getRdoDataByCollaborator(pontoImport.periodStart, periodEndExclusive),
    getEpiAnnualCost()
  ]);
  const epiMensal = epiAnnualCost / 12;

  const rates = [];
  const byCollaboratorId = new Map();
  for (const period of periods) {
    const role = period.collaborator?.role || null;
    const params = role ? roleParams.get(role) : null;
    const rdo = rdoData.get(period.collaboratorId) || { byProject: new Map(), dayProject: new Map() };

    const he70Horas = period.he70Minutes / 60;
    const he100Horas = period.he100Minutes / 60;
    const normalHours = period.workedMinutes / 60;
    const workedDates = period.workedDates || [];
    const workedSet = new Set(workedDates);
    const totalWorkedDays = workedDates.length;

    const entry = {
      collaboratorId: period.collaboratorId,
      name: period.collaborator?.name || period.rawName,
      role,
      hasCostProfile: Boolean(params),
      normalHoras: normalHours,
      he70Horas,
      he100Horas,
      totalHoras: normalHours + he70Horas + he100Horas,
      folgaHours: 0,
      totalMensal: null,
      totalMensalBase: null,
      fixoMensal: null,
      variavelMensal: null,
      custoHora: null,
      custoHoraBase: null,
      idle: { sede: { cost: 0, costBase: 0, hours: 0 }, folga: { cost: 0, costBase: 0, hours: 0 } },
      byProject: {},
      months: [] // detalhe por mês (para o filtro da aba Custo/hora)
    };

    if (params && totalWorkedDays > 0) {
      const cap = Number(params.he70LimiteHoras) || 30; // teto de HE70 por mês (excesso vira 100%)
      const months = monthsOf(period, cap);

      const agg = { folha: 0, folhaBase: 0, fixo: 0, variavel: 0, totalHours: 0, folga: 0, normal: 0, he70: 0, he100: 0 };
      const idle = { sede: { cost: 0, costBase: 0, hours: 0 }, folga: { cost: 0, costBase: 0, hours: 0 } };
      const byProject = {};

      for (const mrec of months) {
        const mk = mrec.monthKey;
        const datesM = mrec.workedDates;
        const workedDaysM = datesM.length;
        const normalHoursM = mrec.normalHours;
        const he70M = mrec.he70Horas;
        const he100M = mrec.he100Horas;
        const hoursPerDayM = workedDaysM > 0 ? normalHoursM / workedDaysM : 0;

        const cov = monthCoverage(mk, fileStart, fileEnd);
        const folgaM = countFolgaWeekdays(cov.start, cov.end, workedSet) * HORAS_POR_DIA;

        const { projAwayDays, projHomeDays, projOffshoreDays } = classifyDays(datesM, rdo);
        const rdoWorkedByPidM = new Map();
        for (const d of datesM) { const dp = rdo.dayProject.get(d); if (dp) rdoWorkedByPidM.set(dp.projectId, (rdoWorkedByPidM.get(dp.projectId) || 0) + dp.hours); }
        const projectIds = [...new Set([...projAwayDays.keys(), ...projHomeDays.keys(), ...projOffshoreDays.keys()])];
        const projects = projectIds.map(pid => ({
          pid,
          rdoDaysHours: ((projAwayDays.get(pid) || 0) + (projHomeDays.get(pid) || 0) + (projOffshoreDays.get(pid) || 0)) * hoursPerDayM,
          awayDaysHours: (projAwayDays.get(pid) || 0) * hoursPerDayM,
          homeDaysHours: (projHomeDays.get(pid) || 0) * hoursPerDayM,
          offshoreDaysHours: (projOffshoreDays.get(pid) || 0) * hoursPerDayM,
          rdoWorkedHours: rdoWorkedByPidM.get(pid) || 0,
          offshore: Boolean(rdo.byProject.get(pid)?.offshore)
        }));

        const res = computeCollaboratorCost({
          params, epiMensal, normalHours: normalHoursM, he70Horas: he70M, he100Horas: he100M,
          folgaHours: folgaM, projects, fixedCoverage: cov.fraction
        });

        agg.folha += res.folha; agg.folhaBase += res.folhaBase; agg.fixo += res.fixoMensal;
        agg.variavel += res.variavelMensal; agg.totalHours += res.totalHours; agg.folga += folgaM;
        agg.normal += normalHoursM; agg.he70 += he70M; agg.he100 += he100M;
        for (const [pid, a] of Object.entries(res.byProject)) {
          if (!byProject[pid]) byProject[pid] = { cost: 0, costBase: 0, hours: 0 };
          byProject[pid].cost += a.cost; byProject[pid].costBase += a.costBase; byProject[pid].hours += a.hours;
        }
        idle.sede.cost += res.idle.sede.cost; idle.sede.costBase += res.idle.sede.costBase; idle.sede.hours += res.idle.sede.hours;
        idle.folga.cost += res.idle.folga.cost; idle.folga.costBase += res.idle.folga.costBase; idle.folga.hours += res.idle.folga.hours;

        entry.months.push({
          month: mk,
          normalHoras: normalHoursM,
          he70Horas: he70M,
          he100Horas: he100M,
          totalMensal: res.folha,
          totalMensalBase: res.folhaBase,
          fixoMensal: res.fixoMensal,
          variavelMensal: res.variavelMensal,
          custoHora: res.totalHours > 0 ? res.folha / res.totalHours : 0,
          custoHoraBase: res.totalHours > 0 ? res.folhaBase / res.totalHours : 0,
          idle: res.idle,
          byProject: res.byProject
        });
      }
      entry.months.sort((a, b) => a.month.localeCompare(b.month));

      entry.totalMensal = agg.folha;
      entry.totalMensalBase = agg.folhaBase;
      entry.fixoMensal = agg.fixo;
      entry.variavelMensal = agg.variavel;
      entry.custoHora = agg.totalHours > 0 ? agg.folha / agg.totalHours : 0;
      entry.custoHoraBase = agg.totalHours > 0 ? agg.folhaBase / agg.totalHours : 0;
      entry.folgaHours = agg.folga;
      // Horas do somado = Σ dos meses (a HE já com teto por mês, pode diferir do split bruto do arquivo).
      entry.normalHoras = agg.normal;
      entry.he70Horas = agg.he70;
      entry.he100Horas = agg.he100;
      entry.totalHoras = agg.normal + agg.he70 + agg.he100;
      entry.byProject = byProject;
      entry.idle = idle;
    }

    rates.push(entry);
    byCollaboratorId.set(period.collaboratorId, entry);
  }
  return { pontoImport, rates, byCollaboratorId };
}

// Diagnóstico: mostra os parâmetros (campos amarelos) e os inputs do motor (Simulador) usados para
// calcular a folha de um colaborador num mês, além do detalhamento do motor. Uso via script.
export async function debugCollaboratorMonth(nameQuery, monthKey, importId = null) {
  const pontoImport = await getLatestPontoImport(importId);
  if (!pontoImport) throw new Error('Sem import de ponto.');
  const periodEndExclusive = endExclusive(pontoImport.periodEnd);
  const [roleParams, rdoData, epiAnnualCost] = await Promise.all([
    getRoleParamsMap(),
    getRdoDataByCollaborator(pontoImport.periodStart, periodEndExclusive),
    getEpiAnnualCost()
  ]);
  const period = await prisma.pontoPeriodSummary.findFirst({
    where: { importId: pontoImport.id, collaborator: { name: { contains: nameQuery, mode: 'insensitive' } } },
    include: { collaborator: { select: { id: true, name: true, role: true } } }
  });
  if (!period) throw new Error(`Colaborador "${nameQuery}" não encontrado no ponto vigente.`);

  const role = period.collaborator.role;
  const params = roleParams.get(role);
  if (!params) throw new Error(`Cargo "${role}" sem custo configurado.`);
  const rdo = rdoData.get(period.collaboratorId) || { byProject: new Map(), dayProject: new Map() };

  const cap = Number(params.he70LimiteHoras) || 30;
  const mrec = monthsOf(period, cap).find(m => m.monthKey === monthKey);
  if (!mrec) throw new Error(`Sem dados de ${nameQuery} no mês ${monthKey}.`);
  const datesM = mrec.workedDates;
  const normalHoursM = mrec.normalHours;
  const he70M = mrec.he70Horas;
  const he100M = mrec.he100Horas;
  const hoursPerDayM = datesM.length > 0 ? normalHoursM / datesM.length : 0;

  const cov = monthCoverage(monthKey, pontoImport.periodStart, pontoImport.periodEnd);
  const folgaHours = countFolgaWeekdays(cov.start, cov.end, new Set(period.workedDates || [])) * HORAS_POR_DIA;

  const { projAwayDays, projHomeDays, projOffshoreDays } = classifyDays(datesM, rdo);
  let projectDaysHours = 0;
  let awayDaysHours = 0;
  let homeDaysHours = 0;
  let offshoreDaysHours = 0;
  const projectIds = [...new Set([...projAwayDays.keys(), ...projHomeDays.keys(), ...projOffshoreDays.keys()])];
  for (const pid of projectIds) {
    const away = (projAwayDays.get(pid) || 0) * hoursPerDayM;
    const home = (projHomeDays.get(pid) || 0) * hoursPerDayM;
    const offshore = (projOffshoreDays.get(pid) || 0) * hoursPerDayM;
    awayDaysHours += away;
    homeDaysHours += home;
    offshoreDaysHours += offshore;
    projectDaysHours += away + home + offshore;
  }

  const inputs = {
    diasCliente: projectDaysHours / HORAS_POR_DIA,
    diasFora: awayDaysHours / HORAS_POR_DIA,
    offshoreDays: offshoreDaysHours / HORAS_POR_DIA,
    offshoreBonusPct: OFFSHORE_TRANSFERENCIA_BONUS_PCT,
    diasCasa: homeDaysHours / HORAS_POR_DIA,
    he70Horas: he70M,
    he100Horas: he100M
  };
  const breakdown = computeMonthlyCost(params, inputs);
  const epiMensal = epiAnnualCost / 12;
  const fixedBaseFull = computeMonthlyCost(params, {}).totalMensal + epiMensal;
  const variavel = (breakdown.totalMensal + epiMensal) - fixedBaseFull;
  const folha = fixedBaseFull * cov.fraction + variavel;

  return {
    name: period.collaborator.name, role, monthKey,
    fixedCoverage: cov.fraction, folgaHours, epiMensal,
    normalHoursMes: normalHoursM,
    params, inputs, breakdown,
    fixoMensal: fixedBaseFull * cov.fraction, variavelMensal: variavel, folha
  };
}

// Custo de mão de obra por projeto (mapa projectId -> { laborCost, laborCostBase, hours }) + sobra total.
export async function laborCostByProject(importId = null) {
  const { pontoImport, byCollaboratorId } = await computeCollaboratorRates(importId);
  if (!pontoImport) {
    return { pontoImport: null, periodStart: null, periodEnd: null, byProjectId: new Map(), idle: { cost: 0, costBase: 0, hours: 0 }, byCollaboratorId: new Map() };
  }
  const byProjectId = new Map();
  const idle = { cost: 0, costBase: 0, hours: 0 };
  for (const entry of byCollaboratorId.values()) {
    for (const [pid, alloc] of Object.entries(entry.byProject)) {
      let agg = byProjectId.get(pid);
      if (!agg) { agg = { laborCost: 0, laborCostBase: 0, hours: 0 }; byProjectId.set(pid, agg); }
      agg.laborCost += alloc.cost;
      agg.laborCostBase += alloc.costBase;
      agg.hours += alloc.hours;
    }
    idle.cost += entry.idle.sede.cost + entry.idle.folga.cost;
    idle.costBase += entry.idle.sede.costBase + entry.idle.folga.costBase;
    idle.hours += entry.idle.sede.hours + entry.idle.folga.hours;
  }
  return { pontoImport, periodStart: pontoImport.periodStart, periodEnd: pontoImport.periodEnd, byProjectId, idle, byCollaboratorId };
}
