import { round1, round2, toNumber } from './project-card-groups.js';

export function progressContributionWeight(progress) {
  let total = 0;
  for (const service of progress?.services ?? []) {
    const plannedQty = (service.systems ?? [])
      .reduce((sum, system) => sum + Math.max(0, toNumber(system.plannedQty) ?? 0), 0);
    if (plannedQty <= 0) continue;
    total += Math.max(0, toNumber(service.weight) ?? 1) * plannedQty;
  }
  return total > 0 ? round2(total) : null;
}

export function combineProgressBreakdowns(progresses = []) {
  const scoped = progresses.filter(progress => progress?.hasScope && Array.isArray(progress.services));
  if (scoped.length === 0) return null;

  const byService = new Map();
  for (const progress of scoped) {
    for (const service of progress.services ?? []) {
      const serviceKey = service.serviceType || 'SERVICO';
      const serviceAcc = byService.get(serviceKey) ?? {
        serviceType: serviceKey,
        weight: 0,
        systems: new Map()
      };
      let hasPlannedSystem = false;
      for (const system of service.systems ?? []) {
        const planned = Math.max(0, toNumber(system.plannedQty) ?? 0);
        if (planned > 0) hasPlannedSystem = true;
        const realized = Math.max(0, toNumber(system.realizedQty) ?? 0);
        const systemKey = `${system.systemType ?? ''}|${system.unit ?? ''}`;
        const systemAcc = serviceAcc.systems.get(systemKey) ?? {
          systemType: system.systemType,
          unit: system.unit ?? null,
          plannedQty: 0,
          realizedQty: 0
        };
        systemAcc.plannedQty += planned;
        systemAcc.realizedQty += realized;
        serviceAcc.systems.set(systemKey, systemAcc);
      }
      if (hasPlannedSystem) {
        serviceAcc.weight += Math.max(0, toNumber(service.weight) ?? 1);
      }
      byService.set(serviceKey, serviceAcc);
    }
  }

  const services = Array.from(byService.values())
    .map(service => {
      const systems = Array.from(service.systems.values())
        .map(system => {
          const pct = system.plannedQty > 0 ? Math.min(system.realizedQty / system.plannedQty, 1) * 100 : null;
          return {
            systemType: system.systemType,
            unit: system.unit,
            plannedQty: system.plannedQty > 0 ? round2(system.plannedQty) : null,
            realizedQty: round2(system.realizedQty),
            pct: pct === null ? null : round1(pct)
          };
        });
      const measurable = systems.filter(system => system.pct !== null);
      const executionPct = measurable.length
        ? round1(measurable.reduce((sum, system) => sum + system.pct, 0) / measurable.length)
        : null;
      return {
        serviceType: service.serviceType,
        weight: service.weight,
        executionPct,
        systems
      };
    })
    .filter(service => service.systems.some(system => system.plannedQty && system.plannedQty > 0))
    .sort((a, b) => String(a.serviceType).localeCompare(String(b.serviceType), 'pt-BR'));

  const weighted = services.filter(service => service.executionPct !== null && service.weight > 0);
  const totalWeight = weighted.reduce((sum, service) => sum + service.weight, 0);
  const progressPct = totalWeight > 0
    ? round1(weighted.reduce((sum, service) => sum + service.weight * service.executionPct, 0) / totalWeight)
    : null;

  return {
    hasScope: services.length > 0,
    progressPct,
    progressMethod: progressPct !== null ? 'GROUP_SCOPE' : null,
    services
  };
}
