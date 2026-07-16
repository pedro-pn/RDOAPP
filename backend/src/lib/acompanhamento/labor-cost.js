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

function parseHm(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function serviceIntervalsWorkedMinutes(services = []) {
  const intervals = (services || [])
    .map(service => {
      const start = parseHm(service?.startTime);
      const rawEnd = parseHm(service?.endTime);
      if (start == null || rawEnd == null) return null;
      const end = rawEnd < start ? rawEnd + 24 * 60 : rawEnd;
      return { start, end };
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);

  let total = 0;
  let current = null;
  for (const interval of intervals) {
    if (!current) {
      current = { ...interval };
      continue;
    }
    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      continue;
    }
    total += current.end - current.start;
    current = { ...interval };
  }
  if (current) total += current.end - current.start;
  return Math.max(0, total);
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

function dateFromYmd(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function pontoImportScopeFromRows(imports) {
  if (!imports.length) return null;
  const latest = [...imports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const periodStart = imports.reduce((min, item) => (
    !min || new Date(item.periodStart) < new Date(min) ? item.periodStart : min
  ), null);
  const periodEnd = imports.reduce((max, item) => (
    !max || new Date(item.periodEnd) > new Date(max) ? item.periodEnd : max
  ), null);
  return {
    pontoImport: latest,
    pontoImports: imports,
    periodStart,
    periodEnd,
    fileName: imports.length === 1 ? latest.fileName : `${imports.length} planilhas importadas`
  };
}

async function getPontoImportScope(importId) {
  if (importId) {
    const item = await prisma.pontoImport.findUnique({ where: { id: importId } });
    return item ? pontoImportScopeFromRows([item]) : null;
  }
  const imports = await prisma.pontoImport.findMany({ orderBy: { createdAt: 'asc' } });
  return pontoImportScopeFromRows(imports);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function effectiveDateKey(set) {
  return set?.effectiveDate ? dateKeyUTC(set.effectiveDate) : '1970-01-01';
}

function createdAtTime(set) {
  const time = set?.createdAt ? new Date(set.createdAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sortParameterSets(sets = []) {
  return [...sets].sort((left, right) => {
    const byDate = effectiveDateKey(left).localeCompare(effectiveDateKey(right));
    if (byDate !== 0) return byDate;
    const byVersion = (Number(left.version) || 0) - (Number(right.version) || 0);
    if (byVersion !== 0) return byVersion;
    return createdAtTime(left) - createdAtTime(right);
  });
}

export function effectiveParameterSetAt(sets = [], dateKey) {
  let selected = null;
  for (const set of sortParameterSets(sets)) {
    if (effectiveDateKey(set) <= dateKey) selected = set;
    else break;
  }
  return selected;
}

function maxDateKey(...keys) {
  return keys.filter(Boolean).sort().at(-1);
}

function minDateKey(...keys) {
  return keys.filter(Boolean).sort()[0];
}

function addDaysKey(dateKey, days) {
  const d = dateFromYmd(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKeyUTC(d);
}

function daysInclusive(startKey, endKey) {
  if (!startKey || !endKey || startKey > endKey) return 0;
  return Math.round((dateFromYmd(endKey).getTime() - dateFromYmd(startKey).getTime()) / 86400000) + 1;
}

function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    monthStartKey: `${monthKey}-01`,
    monthEndKey: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
    daysInMonth: lastDay
  };
}

function coverageForRange(monthKey, fileStart, fileEnd, segmentStartKey, segmentEndKey) {
  const bounds = monthBounds(monthKey);
  const startKey = maxDateKey(bounds.monthStartKey, dateKeyUTC(fileStart), segmentStartKey);
  const endKey = minDateKey(bounds.monthEndKey, dateKeyUTC(fileEnd), segmentEndKey);
  const days = daysInclusive(startKey, endKey);
  return {
    fraction: days > 0 ? days / bounds.daysInMonth : 0,
    start: days > 0 ? dateFromYmd(startKey) : dateFromYmd(bounds.monthStartKey),
    end: days > 0 ? dateFromYmd(endKey) : dateFromYmd(bounds.monthStartKey),
    startKey,
    endKey,
    days
  };
}

function dayRowsFromPeriod(period) {
  const rows = [];
  const sourceCreatedAt = period.import?.createdAt || period.createdAt || new Date(0);
  const monthly = period.monthly && typeof period.monthly === 'object' && !Array.isArray(period.monthly)
    ? period.monthly
    : null;

  if (monthly) {
    for (const [monthKey, monthData] of Object.entries(monthly)) {
      const month = monthData && typeof monthData === 'object' && !Array.isArray(monthData) ? monthData : {};
      if (Array.isArray(month.days) && month.days.length) {
        for (const day of month.days) {
          if (!day?.date) continue;
          rows.push({
            date: String(day.date),
            workedMinutes: numberValue(day.workedMinutes),
            extrasMinutes: numberValue(day.extrasMinutes),
            nightMinutes: numberValue(day.nightMinutes),
            sourceCreatedAt
          });
        }
        continue;
      }

      const workedDates = Array.isArray(month.workedDates) ? month.workedDates : [];
      if (!workedDates.length) continue;
      const normalPerDay = numberValue(month.normalMinutes) / workedDates.length;
      const extrasPerDay = numberValue(month.extrasMinutes) / workedDates.length;
      const nightPerDay = numberValue(month.nightMinutes) / workedDates.length;
      for (const date of workedDates) {
        rows.push({
          date: String(date || monthKey),
          workedMinutes: normalPerDay,
          extrasMinutes: extrasPerDay,
          nightMinutes: nightPerDay,
          sourceCreatedAt
        });
      }
    }
    if (rows.length) return rows;
  }

  const workedDates = Array.isArray(period.workedDates) ? period.workedDates : [];
  if (!workedDates.length) return rows;
  const normalPerDay = numberValue(period.workedMinutes) / workedDates.length;
  const extrasPerDay = (numberValue(period.he70Minutes) + numberValue(period.he100Minutes)) / workedDates.length;
  const nightPerDay = numberValue(period.nightMinutes) / workedDates.length;
  for (const date of workedDates) {
    rows.push({
      date: String(date),
      workedMinutes: normalPerDay,
      extrasMinutes: extrasPerDay,
      nightMinutes: nightPerDay,
      sourceCreatedAt
    });
  }
  return rows;
}

export function mergePontoPeriods(periods = []) {
  const byCollaborator = new Map();
  const sorted = [...periods].sort((left, right) => (
    new Date(left.import?.createdAt || left.createdAt || 0).getTime()
    - new Date(right.import?.createdAt || right.createdAt || 0).getTime()
  ));

  for (const period of sorted) {
    if (!period.collaboratorId) continue;
    let entry = byCollaborator.get(period.collaboratorId);
    if (!entry) {
      entry = {
        collaboratorId: period.collaboratorId,
        rawName: period.rawName,
        normalizedName: period.normalizedName,
        collaborator: period.collaborator || null,
        dayMap: new Map()
      };
      byCollaborator.set(period.collaboratorId, entry);
    }
    entry.rawName = period.rawName || entry.rawName;
    entry.normalizedName = period.normalizedName || entry.normalizedName;
    entry.collaborator = period.collaborator || entry.collaborator;
    for (const row of dayRowsFromPeriod(period)) {
      if (!row.date) continue;
      entry.dayMap.set(row.date, row);
    }
  }

  return [...byCollaborator.values()].map(entry => {
    const days = [...entry.dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const monthly = {};
    for (const day of days) {
      const monthKey = day.date.slice(0, 7);
      if (!monthly[monthKey]) monthly[monthKey] = { normalMinutes: 0, extrasMinutes: 0, nightMinutes: 0, workedDates: [], days: [] };
      monthly[monthKey].normalMinutes += day.workedMinutes;
      monthly[monthKey].extrasMinutes += day.extrasMinutes;
      monthly[monthKey].nightMinutes += day.nightMinutes;
      if (day.workedMinutes > 0) monthly[monthKey].workedDates.push(day.date);
      monthly[monthKey].days.push({
        date: day.date,
        workedMinutes: day.workedMinutes,
        extrasMinutes: day.extrasMinutes,
        nightMinutes: day.nightMinutes
      });
    }
    const workedDates = days.filter(day => day.workedMinutes > 0).map(day => day.date);
    const workedMinutes = days.reduce((sum, day) => sum + day.workedMinutes, 0);
    const extrasMinutes = days.reduce((sum, day) => sum + day.extrasMinutes, 0);
    const nightMinutes = days.reduce((sum, day) => sum + day.nightMinutes, 0);
    const dates = days.map(day => day.date);
    return {
      collaboratorId: entry.collaboratorId,
      rawName: entry.rawName,
      normalizedName: entry.normalizedName,
      collaborator: entry.collaborator,
      periodStart: dates[0] ? dateFromYmd(dates[0]) : null,
      periodEnd: dates[dates.length - 1] ? dateFromYmd(dates[dates.length - 1]) : null,
      workedMinutes,
      he70Minutes: extrasMinutes,
      he100Minutes: 0,
      nightMinutes,
      workedDates,
      monthly
    };
  });
}

// Cargo (JobRole.name = Collaborator.role) -> parâmetros efetivos por data. O cargo herda do modelo
// que estava vigente na data calculada e sobrescreve salário base + insalubridade.
export function buildRoleParamsResolver({ roles = [], models = [] } = {}) {
  const modelSetsByKey = new Map();
  for (const model of models) {
    const sets = sortParameterSets(model.parameterSets || []);
    if (sets.length) modelSetsByKey.set(model.key, sets);
  }
  const fallbackModelKey = modelSetsByKey.has('operador')
    ? 'operador'
    : modelSetsByKey.keys().next().value;

  const roleSetsByName = new Map();
  for (const role of roles) {
    const sets = sortParameterSets(role.costProfile?.parameterSets || []);
    if (sets.length) roleSetsByName.set(role.name, sets);
  }

  function paramsFor(roleName, dateKey) {
    const roleSet = effectiveParameterSetAt(roleSetsByName.get(roleName) || [], dateKey);
    if (!roleSet) return null;
    const override = roleSet.params || {};
    const modelKey = typeof override.baseModel === 'string' && override.baseModel
      ? override.baseModel
      : fallbackModelKey;
    const modelSet = effectiveParameterSetAt(modelSetsByKey.get(modelKey) || [], dateKey)
      || effectiveParameterSetAt(modelSetsByKey.get(fallbackModelKey) || [], dateKey);
    if (!modelSet) return null;

    const effective = { ...(modelSet.params || {}) };
    if (override.salarioBase != null) effective.salarioBase = override.salarioBase;
    if (override.insalubridade != null) effective.insalubridade = override.insalubridade;
    return effective;
  }

  function hasProfile(roleName) {
    return roleSetsByName.has(roleName);
  }

  function changeDatesFor(roleName, startKey, endKey) {
    const dates = new Set([startKey]);
    const add = set => {
      const key = effectiveDateKey(set);
      if (key > startKey && key <= endKey) dates.add(key);
    };
    for (const set of roleSetsByName.get(roleName) || []) add(set);
    for (const sets of modelSetsByKey.values()) {
      for (const set of sets) add(set);
    }
    return [...dates].sort();
  }

  function segmentsFor(roleName, startKey, endKey) {
    return changeDatesFor(roleName, startKey, endKey)
      .map((startKeyForSegment, index, starts) => {
        const nextStart = starts[index + 1];
        return {
          startKey: startKeyForSegment,
          endKey: nextStart ? addDaysKey(nextStart, -1) : endKey,
          params: paramsFor(roleName, startKeyForSegment)
        };
      })
      .filter(segment => segment.startKey <= segment.endKey);
  }

  return { paramsFor, segmentsFor, hasProfile };
}

async function getRoleParamsResolver() {
  const [roles, models] = await Promise.all([
    prisma.jobRole.findMany({
      include: { costProfile: { include: { parameterSets: true } } }
    }),
    prisma.costProfile.findMany({
      where: { jobRoleId: null },
      include: { parameterSets: true }
    })
  ]);
  return buildRoleParamsResolver({ roles, models });
}

function reportWorkedMinutes(report) {
  const recorded = (Number(report.daytimeWorkedMinutes) || 0) + (Number(report.nighttimeWorkedMinutes) || 0);
  if (recorded > 0 || report.reportType === 'RDO') return recorded;
  return serviceIntervalsWorkedMinutes(report.services || []);
}

export function rdoDataByCollaboratorFromReports(reports) {
  const map = new Map();
  for (const report of reports) {
    const workedMinutes = reportWorkedMinutes(report);
    if (report.reportType !== 'RDO' && workedMinutes <= 0) continue;
    const dk = dateKeyUTC(report.reportDate);
    const workedHours = workedMinutes / 60;
    const offshore = Boolean(report.project?.offshore);
    for (const link of report.collaborators || []) {
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

// RDO por colaborador: por projeto (offshore) e o projeto/horas de cada dia.
async function getRdoDataByCollaborator(periodStart, periodEndExclusive) {
  const reports = await prisma.report.findMany({
    where: {
      deletedAt: null,
      reportDate: { gte: periodStart, lt: periodEndExclusive },
      OR: [
        { reportType: 'RDO' },
        { daytimeWorkedMinutes: { gt: 0 } },
        { nighttimeWorkedMinutes: { gt: 0 } },
        { services: { some: { startTime: { not: null }, endTime: { not: null } } } }
      ]
    },
    select: {
      reportType: true,
      projectId: true,
      reportDate: true,
      daytimeWorkedMinutes: true,
      nighttimeWorkedMinutes: true,
      project: { select: { offshore: true, laborSleepModeByCollaborator: true } },
      collaborators: { select: { collaboratorId: true } },
      services: { select: { startTime: true, endTime: true } }
    }
  });
  return rdoDataByCollaboratorFromReports(reports);
}

function classifyProjectHours(dayRows, rdo) {
  const projAwayHours = new Map();
  const projHomeHours = new Map();
  const projOffshoreHours = new Map();
  const rdoWorkedByPid = new Map();
  for (const row of dayRows) {
    const dp = rdo.dayProject.get(row.date);
    if (!dp) continue;
    const hours = Math.max(0, row.normalHours || 0);
    const target = dp.offshore ? projOffshoreHours : dp.sleepMode === 'HOME' ? projHomeHours : projAwayHours;
    target.set(dp.projectId, (target.get(dp.projectId) || 0) + hours);
    rdoWorkedByPid.set(dp.projectId, (rdoWorkedByPid.get(dp.projectId) || 0) + (dp.hours || 0));
  }
  return { projAwayHours, projHomeHours, projOffshoreHours, rdoWorkedByPid };
}

// Fração do mês coberta pelo arquivo (para proporcionalizar o fixo no mês parcial).
function monthCoverage(monthKey, fileStart, fileEnd) {
  const bounds = monthBounds(monthKey);
  return coverageForRange(monthKey, fileStart, fileEnd, bounds.monthStartKey, bounds.monthEndKey);
}

// Divide a hora extra do mês em 70% e 100% com teto de HE70 (padrão 30h/mês): o excesso vira 100%.
export function splitOvertime(extrasHoras, cap = 30) {
  const he70Horas = Math.min(cap, Math.max(0, extrasHoras));
  const he100Horas = Math.max(0, extrasHoras - cap);
  return { he70Horas, he100Horas };
}

function splitOvertimeDays(days, cap = 30) {
  let he70Remaining = Math.max(0, cap);
  return days.map(day => {
    const extrasHoras = Math.max(0, day.extrasHoras || 0);
    const he70Horas = Math.min(he70Remaining, extrasHoras);
    he70Remaining -= he70Horas;
    return {
      ...day,
      he70Horas,
      he100Horas: Math.max(0, extrasHoras - he70Horas)
    };
  });
}

function monthRowsFromMonthlyData(monthKey, monthData) {
  const month = monthData && typeof monthData === 'object' && !Array.isArray(monthData) ? monthData : {};
  if (Array.isArray(month.days) && month.days.length) {
    return month.days
      .filter(day => day?.date)
      .map(day => ({
        date: String(day.date),
        normalHours: numberValue(day.workedMinutes) / 60,
        extrasHoras: numberValue(day.extrasMinutes) / 60
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const workedDates = Array.isArray(month.workedDates) ? month.workedDates : [];
  if (!workedDates.length) return [];
  const normalPerDay = numberValue(month.normalMinutes) / workedDates.length / 60;
  const extrasPerDay = numberValue(month.extrasMinutes) / workedDates.length / 60;
  return workedDates
    .filter(Boolean)
    .map(date => ({ date: String(date || monthKey), normalHours: normalPerDay, extrasHoras: extrasPerDay }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Detalhe por mês do colaborador: usa os dias do ponto quando disponíveis; se ausentes (imports
// antigos), apropria os totais do período pela proporção de dias trabalhados.
function monthsOf(period) {
  if (period.monthly && typeof period.monthly === 'object' && Object.keys(period.monthly).length) {
    return Object.entries(period.monthly).map(([monthKey, month]) => {
      const days = monthRowsFromMonthlyData(monthKey, month);
      return {
        monthKey,
        days,
        workedDates: days.filter(day => day.normalHours > 0).map(day => day.date)
      };
    });
  }
  const workedDates = period.workedDates || [];
  const total = workedDates.length || 1;
  const byMonth = new Map();
  for (const d of workedDates) { const mk = d.slice(0, 7); if (!byMonth.has(mk)) byMonth.set(mk, []); byMonth.get(mk).push(d); }
  return [...byMonth.entries()].map(([monthKey, dates]) => {
    const ratio = dates.length / total;
    const normalPerDay = ((period.workedMinutes / 60) * ratio) / (dates.length || 1);
    const extrasPerDay = (((period.he70Minutes + period.he100Minutes) / 60) * ratio) / (dates.length || 1);
    return {
      monthKey,
      days: dates.map(date => ({ date, normalHours: normalPerDay, extrasHoras: extrasPerDay })),
      workedDates: dates
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
  if (totalHours <= 0) {
    return {
      folha,
      folhaBase,
      fixoMensal: fixedBase,
      variavelMensal,
      totalHours,
      byProject,
      idle: {
        sede: { cost: folha, costBase: folhaBase, hours: 0 },
        folga: { cost: 0, costBase: 0, hours: 0 }
      }
    };
  }

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
  const pontoScope = await getPontoImportScope(importId);
  if (!pontoScope) return { pontoImport: null, pontoImports: [], periodStart: null, periodEnd: null, fileName: null, rates: [], byCollaboratorId: new Map() };

  const importIds = pontoScope.pontoImports.map(item => item.id);
  const periodEndExclusive = endExclusive(pontoScope.periodEnd);
  const fileStart = pontoScope.periodStart;
  const fileEnd = pontoScope.periodEnd;
  const [periodRows, roleParams, rdoData, epiAnnualCost] = await Promise.all([
    prisma.pontoPeriodSummary.findMany({
      where: { importId: { in: importIds }, collaboratorId: { not: null } },
      include: {
        collaborator: { select: { id: true, name: true, role: true } },
        import: { select: { createdAt: true } }
      }
    }),
    getRoleParamsResolver(),
    getRdoDataByCollaborator(pontoScope.periodStart, periodEndExclusive),
    getEpiAnnualCost()
  ]);
  const periods = mergePontoPeriods(periodRows);
  const epiMensal = epiAnnualCost / 12;

  const rates = [];
  const byCollaboratorId = new Map();
  for (const period of periods) {
    const role = period.collaborator?.role || null;
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
      hasCostProfile: false,
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

    if (role && roleParams.hasProfile(role) && totalWorkedDays > 0) {
      const months = monthsOf(period);

      const agg = { folha: 0, folhaBase: 0, fixo: 0, variavel: 0, totalHours: 0, folga: 0, normal: 0, he70: 0, he100: 0 };
      const idle = { sede: { cost: 0, costBase: 0, hours: 0 }, folga: { cost: 0, costBase: 0, hours: 0 } };
      const byProject = {};
      let computedAny = false;

      for (const mrec of months) {
        const mk = mrec.monthKey;
        const monthCov = monthCoverage(mk, fileStart, fileEnd);
        if (monthCov.days <= 0) continue;
        const capParams = roleParams.paramsFor(role, monthCov.startKey) || roleParams.paramsFor(role, `${mk}-01`);
        const cap = Number(capParams?.he70LimiteHoras) || 30; // teto de HE70 por mês (excesso vira 100%)
        const daysWithOvertime = splitOvertimeDays(mrec.days || [], cap);
        const segments = roleParams.segmentsFor(role, monthCov.startKey, monthCov.endKey);

        const monthAgg = { folha: 0, folhaBase: 0, fixo: 0, variavel: 0, totalHours: 0, folga: 0, normal: 0, he70: 0, he100: 0 };
        const monthIdle = { sede: { cost: 0, costBase: 0, hours: 0 }, folga: { cost: 0, costBase: 0, hours: 0 } };
        const monthByProject = {};

        for (const segment of segments) {
          if (!segment.params) continue;
          const segCov = coverageForRange(mk, fileStart, fileEnd, segment.startKey, segment.endKey);
          if (segCov.days <= 0) continue;
          const segmentDays = daysWithOvertime.filter(day => day.date >= segCov.startKey && day.date <= segCov.endKey);
          const normalHoursS = segmentDays.reduce((sum, day) => sum + (day.normalHours || 0), 0);
          const he70S = segmentDays.reduce((sum, day) => sum + (day.he70Horas || 0), 0);
          const he100S = segmentDays.reduce((sum, day) => sum + (day.he100Horas || 0), 0);
          const folgaS = countFolgaWeekdays(segCov.start, segCov.end, workedSet) * HORAS_POR_DIA;

          const { projAwayHours, projHomeHours, projOffshoreHours, rdoWorkedByPid } = classifyProjectHours(segmentDays, rdo);
          const projectIds = [...new Set([...projAwayHours.keys(), ...projHomeHours.keys(), ...projOffshoreHours.keys()])];
          const projects = projectIds.map(pid => ({
            pid,
            rdoDaysHours: (projAwayHours.get(pid) || 0) + (projHomeHours.get(pid) || 0) + (projOffshoreHours.get(pid) || 0),
            awayDaysHours: projAwayHours.get(pid) || 0,
            homeDaysHours: projHomeHours.get(pid) || 0,
            offshoreDaysHours: projOffshoreHours.get(pid) || 0,
            rdoWorkedHours: rdoWorkedByPid.get(pid) || 0,
            offshore: Boolean(rdo.byProject.get(pid)?.offshore)
          }));

          const res = computeCollaboratorCost({
            params: segment.params, epiMensal, normalHours: normalHoursS, he70Horas: he70S, he100Horas: he100S,
            folgaHours: folgaS, projects, fixedCoverage: segCov.fraction
          });

          computedAny = true;
          monthAgg.folha += res.folha; monthAgg.folhaBase += res.folhaBase; monthAgg.fixo += res.fixoMensal;
          monthAgg.variavel += res.variavelMensal; monthAgg.totalHours += res.totalHours; monthAgg.folga += folgaS;
          monthAgg.normal += normalHoursS; monthAgg.he70 += he70S; monthAgg.he100 += he100S;
          for (const [pid, a] of Object.entries(res.byProject)) {
            if (!monthByProject[pid]) monthByProject[pid] = { cost: 0, costBase: 0, hours: 0 };
            monthByProject[pid].cost += a.cost; monthByProject[pid].costBase += a.costBase; monthByProject[pid].hours += a.hours;
          }
          monthIdle.sede.cost += res.idle.sede.cost; monthIdle.sede.costBase += res.idle.sede.costBase; monthIdle.sede.hours += res.idle.sede.hours;
          monthIdle.folga.cost += res.idle.folga.cost; monthIdle.folga.costBase += res.idle.folga.costBase; monthIdle.folga.hours += res.idle.folga.hours;
        }

        if (monthAgg.totalHours <= 0 && monthAgg.folha === 0) continue;
        agg.folha += monthAgg.folha; agg.folhaBase += monthAgg.folhaBase; agg.fixo += monthAgg.fixo;
        agg.variavel += monthAgg.variavel; agg.totalHours += monthAgg.totalHours; agg.folga += monthAgg.folga;
        agg.normal += monthAgg.normal; agg.he70 += monthAgg.he70; agg.he100 += monthAgg.he100;
        for (const [pid, a] of Object.entries(monthByProject)) {
          if (!byProject[pid]) byProject[pid] = { cost: 0, costBase: 0, hours: 0 };
          byProject[pid].cost += a.cost; byProject[pid].costBase += a.costBase; byProject[pid].hours += a.hours;
        }
        idle.sede.cost += monthIdle.sede.cost; idle.sede.costBase += monthIdle.sede.costBase; idle.sede.hours += monthIdle.sede.hours;
        idle.folga.cost += monthIdle.folga.cost; idle.folga.costBase += monthIdle.folga.costBase; idle.folga.hours += monthIdle.folga.hours;

        entry.months.push({
          month: mk,
          normalHoras: monthAgg.normal,
          he70Horas: monthAgg.he70,
          he100Horas: monthAgg.he100,
          totalMensal: monthAgg.folha,
          totalMensalBase: monthAgg.folhaBase,
          fixoMensal: monthAgg.fixo,
          variavelMensal: monthAgg.variavel,
          custoHora: monthAgg.totalHours > 0 ? monthAgg.folha / monthAgg.totalHours : 0,
          custoHoraBase: monthAgg.totalHours > 0 ? monthAgg.folhaBase / monthAgg.totalHours : 0,
          idle: monthIdle,
          byProject: monthByProject
        });
      }
      entry.months.sort((a, b) => a.month.localeCompare(b.month));

      if (computedAny) {
        entry.hasCostProfile = true;
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
    }

    rates.push(entry);
    byCollaboratorId.set(period.collaboratorId, entry);
  }
  return {
    pontoImport: pontoScope.pontoImport,
    pontoImports: pontoScope.pontoImports,
    periodStart: pontoScope.periodStart,
    periodEnd: pontoScope.periodEnd,
    fileName: pontoScope.fileName,
    rates,
    byCollaboratorId
  };
}

// Diagnóstico: mostra os parâmetros (campos amarelos) e os inputs do motor (Simulador) usados para
// calcular a folha de um colaborador num mês, além do detalhamento do motor. Uso via script.
export async function debugCollaboratorMonth(nameQuery, monthKey, importId = null) {
  const pontoScope = await getPontoImportScope(importId);
  if (!pontoScope) throw new Error('Sem import de ponto.');
  const importIds = pontoScope.pontoImports.map(item => item.id);
  const periodEndExclusive = endExclusive(pontoScope.periodEnd);
  const [periodRows, roleParams, rdoData, epiAnnualCost] = await Promise.all([
    prisma.pontoPeriodSummary.findMany({
      where: { importId: { in: importIds }, collaboratorId: { not: null } },
      include: {
        collaborator: { select: { id: true, name: true, role: true } },
        import: { select: { createdAt: true } }
      }
    }),
    getRoleParamsResolver(),
    getRdoDataByCollaborator(pontoScope.periodStart, periodEndExclusive),
    getEpiAnnualCost()
  ]);
  const query = String(nameQuery || '').trim().toLowerCase();
  const period = mergePontoPeriods(periodRows).find(item => (
    String(item.collaborator?.name || item.rawName || '').toLowerCase().includes(query)
  ));
  if (!period) throw new Error(`Colaborador "${nameQuery}" não encontrado no ponto vigente.`);

  const role = period.collaborator.role;
  const cov = monthCoverage(monthKey, pontoScope.periodStart, pontoScope.periodEnd);
  const params = roleParams.paramsFor(role, cov.startKey);
  if (!params) throw new Error(`Cargo "${role}" sem custo configurado.`);
  const rdo = rdoData.get(period.collaboratorId) || { byProject: new Map(), dayProject: new Map() };

  const cap = Number(params.he70LimiteHoras) || 30;
  const mrec = monthsOf(period).find(m => m.monthKey === monthKey);
  if (!mrec) throw new Error(`Sem dados de ${nameQuery} no mês ${monthKey}.`);
  const daysM = splitOvertimeDays(mrec.days || [], cap);
  const normalHoursM = daysM.reduce((sum, day) => sum + (day.normalHours || 0), 0);
  const he70M = daysM.reduce((sum, day) => sum + (day.he70Horas || 0), 0);
  const he100M = daysM.reduce((sum, day) => sum + (day.he100Horas || 0), 0);
  const folgaHours = countFolgaWeekdays(cov.start, cov.end, new Set(period.workedDates || [])) * HORAS_POR_DIA;

  const { projAwayHours, projHomeHours, projOffshoreHours } = classifyProjectHours(daysM, rdo);
  let projectDaysHours = 0;
  let awayDaysHours = 0;
  let homeDaysHours = 0;
  let offshoreDaysHours = 0;
  const projectIds = [...new Set([...projAwayHours.keys(), ...projHomeHours.keys(), ...projOffshoreHours.keys()])];
  for (const pid of projectIds) {
    const away = projAwayHours.get(pid) || 0;
    const home = projHomeHours.get(pid) || 0;
    const offshore = projOffshoreHours.get(pid) || 0;
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
  const { pontoImport, periodStart, periodEnd, byCollaboratorId } = await computeCollaboratorRates(importId);
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
  return { pontoImport, periodStart, periodEnd, byProjectId, idle, byCollaboratorId };
}
