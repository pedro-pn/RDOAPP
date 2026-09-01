import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  listPlanningAbsences,
  listPlanningCollaborators,
  listPlanningMissions,
  type PlanningJobRole,
  type PlanningMission
} from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { displayDateOnly } from '../../../utils/calendarGrid';
import { AVAILABILITY_STATUSES, buildMissionAvailabilityColumns, type AvailabilityStatus } from '../../../utils/collaboratorAvailability';
import { filterMissionTeamCollaborators, toggleMissionCollaborator } from '../../../utils/missionTeam';

const COLUMN_META: Record<AvailabilityStatus, { label: string; description: string }> = {
  AVAILABLE: { label: 'Disponíveis', description: 'Livres durante todo o período' },
  AWAITING_MOBILIZATION: { label: 'Aguardando mobilização', description: 'Já previstos em outra missão' },
  MOBILIZED: { label: 'Mobilizados', description: 'Alocados em missão no período' },
  ON_VACATION: { label: 'De férias', description: 'Férias sobrepostas às datas' }
};

type AllocationPeriodDraft = {
  collaboratorId: string;
  mobilizationDate: string;
  demobilizationDate: string;
};

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('pt-BR');
}

function selectedAllocationCollaborator(mission: PlanningMission | null, collaboratorId: string) {
  return mission?.allocations.find(allocation => allocation.collaboratorId === collaboratorId)?.collaborator || null;
}

export function MissionTeamSelector({ mission, planId, roles, selectedIds, allocationPeriods, startDate, endDate, loading, disabled, error, onChange, onAllocationPeriodsChange }: {
  mission: PlanningMission | null;
  planId?: string;
  roles: PlanningJobRole[];
  selectedIds: string[];
  allocationPeriods: AllocationPeriodDraft[];
  startDate: string;
  endDate: string;
  loading: boolean;
  disabled: boolean;
  error?: string;
  onChange: (value: string[], confirmedMissionOverlapCollaboratorIds: string[]) => void;
  onAllocationPeriodsChange: (value: AllocationPeriodDraft[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [overlapConfirmationIds, setOverlapConfirmationIds] = useState<string[]>([]);
  const validPeriod = Boolean(/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate);
  const collaborators = useQuery({
    queryKey: ['efetivo-mission-team-collaborators', startDate],
    queryFn: () => listPlanningCollaborators({ date: startDate }),
    enabled: open && validPeriod
  });
  const missions = useQuery({
    queryKey: ['efetivo-planning-missions', 'team-availability', planId || 'official'],
    queryFn: () => listPlanningMissions({ planId }),
    enabled: open && validPeriod
  });
  const absences = useQuery({
    queryKey: ['efetivo-mission-team-absences', startDate, endDate],
    queryFn: () => listPlanningAbsences({ startDate, endDate }),
    enabled: open && validPeriod
  });
  useEffect(() => {
    if (open) setDraftIds(selectedIds);
  }, [open, selectedIds]);

  const options = useMemo(() => {
    const result = [...(collaborators.data || [])];
    for (const collaboratorId of selectedIds) {
      if (result.some(item => item.id === collaboratorId)) continue;
      const collaborator = selectedAllocationCollaborator(mission, collaboratorId);
      if (!collaborator) continue;
      result.push({
        id: collaborator.id,
        name: collaborator.name,
        role: collaborator.role,
        jobRoleId: collaborator.jobRoleId,
        admissionDate: null,
        terminationDate: null,
        isActive: false,
        status: 'OUTSIDE_EMPLOYMENT' as const,
        plannedUtilization90d: null,
        vacationAlert: null
      });
    }
    return result;
  }, [collaborators.data, mission, selectedIds]);
  const { columns, otherUnavailable } = useMemo(() => validPeriod
    ? buildMissionAvailabilityColumns(options, missions.data || [], absences.data || [], startDate, endDate, mission?.id)
    : buildMissionAvailabilityColumns([], [], [], '2000-01-01', '2000-01-01'),
  [absences.data, endDate, mission?.id, missions.data, options, startDate, validPeriod]);
  const operationalRoleIds = useMemo(() => new Set(roles.filter(role => role.isOperational).map(role => role.id)), [roles]);
  const selectedPeople = options.filter(collaborator => selectedIds.includes(collaborator.id));
  const roleSummary = [...selectedPeople.reduce((summary, collaborator) => {
    const label = collaborator.role || 'Cargo não informado';
    summary.set(label, (summary.get(label) || 0) + 1);
    return summary;
  }, new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right, 'pt-BR'));
  const queryLoading = loading || collaborators.isLoading || missions.isLoading || absences.isLoading;
  const queryError = collaborators.isError || missions.isError || absences.isError;
  const visibleIds = new Set(AVAILABILITY_STATUSES.flatMap(status => columns[status].map(entry => entry.collaborator.id)));
  const hiddenSelected = options.filter(collaborator => draftIds.includes(collaborator.id) && !visibleIds.has(collaborator.id));
  const existingConfirmedOverlapIds = mission?.allocations
    .filter(allocation => allocation.allowMissionOverlap)
    .map(allocation => allocation.collaboratorId) || [];
  const overlappingDraftIds = [...new Set(['AWAITING_MOBILIZATION', 'MOBILIZED']
    .flatMap(status => columns[status as AvailabilityStatus])
    .filter(entry => draftIds.includes(entry.collaborator.id)
      && !existingConfirmedOverlapIds.includes(entry.collaborator.id))
    .map(entry => entry.collaborator.id))];
  const applyTeam = (confirmedIds: string[] = []) => {
    onChange(draftIds, [...new Set([
      ...existingConfirmedOverlapIds.filter(id => draftIds.includes(id)),
      ...confirmedIds
    ])]);
    setOverlapConfirmationIds([]);
    setOpen(false);
  };
  const requestApplyTeam = () => {
    if (overlappingDraftIds.length) {
      setOverlapConfirmationIds(overlappingDraftIds);
      return;
    }
    applyTeam();
  };
  const updateAllocationPeriod = (collaboratorId: string, field: 'mobilizationDate' | 'demobilizationDate', value: string) => {
    const current = allocationPeriods.find(period => period.collaboratorId === collaboratorId) || {
      collaboratorId,
      mobilizationDate: startDate,
      demobilizationDate: endDate
    };
    onAllocationPeriodsChange([
      ...allocationPeriods.filter(period => period.collaboratorId !== collaboratorId),
      { ...current, [field]: value }
    ]);
  };

  return (
    <>
      <fieldset className={`efetivo-team-fieldset efetivo-form-wide ${error ? 'field-invalid' : ''}`}>
        <legend>Equipe da missão</legend>
        <div className="efetivo-team-picker-trigger">
          <div><strong>{selectedIds.length} {selectedIds.length === 1 ? 'colaborador selecionado' : 'colaboradores selecionados'}</strong><span>Consulte a disponibilidade considerando todas as datas da programação.</span></div>
          <Button variant="secondary" disabled={disabled} onClick={() => { setSearch(''); setRoleFilter(''); setOpen(true); }}>Ver colaboradores</Button>
        </div>
        {!validPeriod ? <span className="field-hint">Preencha a mobilização e o fim da execução para consultar os colaboradores.</span> : null}
        {roleSummary.length ? <div className="efetivo-team-summary" aria-label="Resumo da equipe por cargo">{roleSummary.map(([role, count]) => <span key={role}>{role} <strong>{count}</strong></span>)}</div> : null}
        {selectedIds.length && mission ? <div className="efetivo-team-period-overview" aria-label="Ciclos de mobilização da equipe">
          <div className="efetivo-team-period-heading"><strong>Ciclos de mobilização</strong><span>Salve a programação e use “Gerenciar equipe” na missão para adicionar pausas, retornos e datas individuais.</span></div>
        </div> : null}
        {selectedIds.length && !mission ? <div className="efetivo-team-period-overview" aria-label="Mobilização e desmobilização por colaborador">
          <div className="efetivo-team-period-heading"><strong>Datas individuais da equipe</strong><span>As datas gerais são usadas como padrão. Ajuste somente quem entra ou sai em outro dia.</span></div>
          {selectedIds.map(collaboratorId => {
            const collaborator = options.find(item => item.id === collaboratorId);
            const period = allocationPeriods.find(item => item.collaboratorId === collaboratorId) || {
              collaboratorId,
              mobilizationDate: startDate,
              demobilizationDate: endDate
            };
            return <div className="efetivo-team-period-row" key={collaboratorId}>
              <div className="efetivo-team-period-person"><strong>{collaborator?.name || 'Colaborador selecionado'}</strong><span>{collaborator?.role || 'Cargo não informado'}</span></div>
              <label className="field-group" htmlFor={`mission-team-mobilization-${collaboratorId}`}><span>Mobilização</span><input id={`mission-team-mobilization-${collaboratorId}`} type="date" min={startDate} max={endDate} disabled={disabled} value={period.mobilizationDate} onChange={event => updateAllocationPeriod(collaboratorId, 'mobilizationDate', event.target.value)} /></label>
              <label className="field-group" htmlFor={`mission-team-demobilization-${collaboratorId}`}><span>Desmobilização</span><input id={`mission-team-demobilization-${collaboratorId}`} type="date" min={period.mobilizationDate || startDate} max={endDate} disabled={disabled} value={period.demobilizationDate} onChange={event => updateAllocationPeriod(collaboratorId, 'demobilizationDate', event.target.value)} /></label>
            </div>;
          })}
        </div> : null}
        {error ? <span className="field-error" role="alert">{error}</span> : null}
      </fieldset>

      {typeof document === 'undefined' ? null : createPortal(<Modal open={open} onClose={() => setOpen(false)} ariaLabelledBy="mission-team-dialog-title" ariaDescribedBy="mission-team-dialog-description" backdropClassName="modal-backdrop efetivo-team-availability-backdrop" panelClassName="modal-card efetivo-modal efetivo-team-availability-modal">
        <div className="efetivo-modal-layout">
          <header className="efetivo-modal-header"><div><h3 id="mission-team-dialog-title">Colaboradores por disponibilidade</h3><p id="mission-team-dialog-description">{displayDateOnly(startDate)} a {displayDateOnly(endDate)} · pessoas já alocadas podem ser selecionadas mediante confirmação.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button></header>
          <div className="efetivo-modal-body efetivo-team-availability-body">
            <div className="efetivo-team-dialog-toolbar">
              <label className="field-group" htmlFor="mission-team-search"><span>Buscar por nome ou cargo</span><input id="mission-team-search" type="search" value={search} placeholder="Ex.: mantenedor ou nome" onChange={event => setSearch(event.target.value)} /></label>
              <label className="field-group" htmlFor="mission-team-role-filter"><span>Filtrar por cargo</span><select id="mission-team-role-filter" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">Todos os cargos</option>{roles.filter(role => role.isOperational).map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
              <strong>{draftIds.length} selecionado(s)</strong>
            </div>
            {!validPeriod ? <div className="efetivo-team-period-empty"><strong>Informe o período da missão</strong><span>Preencha a mobilização e o fim da execução para calcular quais colaboradores estarão disponíveis.</span></div>
              : queryLoading ? <p className="placeholder-copy">Calculando disponibilidade no período…</p>
              : queryError ? <p className="placeholder-copy">Não foi possível consultar a disponibilidade.</p>
                : <>
                  {otherUnavailable ? <p className="efetivo-availability-note">{otherUnavailable} colaborador(es) em folga, afastamento ou fora do vínculo no período não aparecem no quadro.</p> : null}
                  {hiddenSelected.length ? <div className="efetivo-team-hidden-selected"><strong>Selecionados fora do quadro</strong><span>Podem ser removidos, mas não selecionados novamente para este período.</span>{hiddenSelected.map(collaborator => <div key={collaborator.id}><span>{collaborator.name} · {collaborator.role || 'Cargo não informado'}</span><Button variant="mini" onClick={() => setDraftIds(current => toggleMissionCollaborator(current, collaborator.id, false))}>Remover</Button></div>)}</div> : null}
                  <section className="efetivo-availability-kanban efetivo-team-availability-kanban" aria-label="Disponibilidade dos colaboradores para a missão">
                    {AVAILABILITY_STATUSES.map(status => {
                      const entries = columns[status].filter(entry => (
                        (!roleFilter || entry.collaborator.jobRoleId === roleFilter)
                        && filterMissionTeamCollaborators([entry.collaborator], search).length > 0
                      ));
                      return (
                        <div className="efetivo-kanban-column efetivo-availability-column" data-availability-status={status} key={status}>
                          <header><div><strong><span className="efetivo-stage-dot" aria-hidden="true" />{COLUMN_META[status].label}</strong><span>{entries.length}</span></div><small>{COLUMN_META[status].description}</small></header>
                          <div className="efetivo-kanban-list">
                            {entries.length ? entries.map(entry => {
                              const selected = draftIds.includes(entry.collaborator.id);
                              const hasOperationalRole = Boolean(entry.collaborator.jobRoleId && operationalRoleIds.has(entry.collaborator.jobRoleId));
                              const hasMissionOverlap = status === 'AWAITING_MOBILIZATION' || status === 'MOBILIZED';
                              const selectable = status !== 'ON_VACATION' && entry.collaborator.isActive && hasOperationalRole;
                              return (
                                <article className={`efetivo-availability-card efetivo-team-availability-card ${selected ? 'selected' : ''} ${!selectable ? 'unavailable' : ''}`} data-collaborator-id={entry.collaborator.id} key={entry.collaborator.id}>
                                  <label><input type="checkbox" checked={selected} disabled={disabled || (!selectable && !selected)} onChange={event => setDraftIds(current => toggleMissionCollaborator(current, entry.collaborator.id, event.target.checked))} /><div className="efetivo-availability-person"><i aria-hidden="true">{initials(entry.collaborator.name)}</i><span><strong>{entry.collaborator.name}</strong><small>{entry.collaborator.role || 'Cargo não informado'}</small></span></div></label>
                                  {entry.mission ? <div className="efetivo-availability-context"><span>{entry.mission.project.code} · {entry.mission.project.name}</span><small>Mobilização em {displayDateOnly(entry.mission.mobilizationDate)}</small></div> : null}
                                  {hasMissionOverlap ? <div className="efetivo-availability-context efetivo-overlap-warning"><small>Pode ser selecionado, mas exige confirmação de sobreposição.</small></div> : null}
                                  {entry.absence ? <div className="efetivo-availability-context"><span>Férias no período</span><small>Até {displayDateOnly(entry.absence.endDate)}</small></div> : null}
                                  {status === 'AVAILABLE' && !hasOperationalRole ? <div className="efetivo-availability-context"><small>Sem função operacional vinculada</small></div> : null}
                                </article>
                              );
                            }) : <p className="efetivo-kanban-empty">Nenhum colaborador nesta situação</p>}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                </>}
          </div>
          <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!validPeriod || queryLoading || queryError} onClick={requestApplyTeam}>Aplicar equipe</Button></footer>
        </div>
      </Modal>, document.body)}
      <ConfirmDialog
        open={overlapConfirmationIds.length > 0}
        title="Confirmar colaborador em mais de uma missão?"
        description="Os colaboradores destacados já possuem outra missão no período. A sobreposição ficará registrada na programação."
        highlight={overlapConfirmationIds.map(id => options.find(item => item.id === id)?.name).filter(Boolean).join(', ')}
        confirmLabel="Confirmar sobreposição"
        danger={false}
        onConfirm={() => applyTeam(overlapConfirmationIds)}
        onCancel={() => setOverlapConfirmationIds([])}
      />
    </>
  );
}
