import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  createPlanningMission,
  deletePlanningMission,
  listPlanningCollaborators,
  listPlanningCoordinators,
  listPlanningJobRoles,
  listPlanningMissions,
  listPlanningProjects,
  updatePlanningMission,
  type MissionInput,
  type MissionScheduleStatus,
  type PlanningMission
} from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SearchBar } from '../../../components/ui/SearchBar';
import { useToast } from '../../../components/ui/ToastContext';
import { displayDateOnly, todayDateOnly } from '../../../utils/calendarGrid';
import { MissionAllocationModal } from './MissionAllocationModal';
import { MissionFormModal } from './MissionFormModal';

const statusLabel = { DRAFT: 'Rascunho', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' } as const;

export function MissionsBoard({ canManage, planId, status, search, selectedMissionId, onSearchChange, onStatusChange, onMissionSelect }: {
  canManage: boolean;
  planId?: string;
  status?: MissionScheduleStatus;
  search: string;
  selectedMissionId?: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: MissionScheduleStatus | undefined) => void;
  onMissionSelect?: (missionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<PlanningMission | null>(null);
  const [allocating, setAllocating] = useState<PlanningMission | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<PlanningMission | null>(null);
  const missions = useQuery({ queryKey: ['efetivo-planning-missions', planId || 'official', status || 'all'], queryFn: () => listPlanningMissions({ planId, status }) });
  const roles = useQuery({ queryKey: ['efetivo-planning-job-roles'], queryFn: listPlanningJobRoles });
  const coordinators = useQuery({ queryKey: ['efetivo-planning-coordinators'], queryFn: listPlanningCoordinators });
  const projects = useQuery({ queryKey: ['efetivo-planning-projects'], queryFn: () => listPlanningProjects() });
  const collaborators = useQuery({ queryKey: ['efetivo-planning-collaborators-options'], queryFn: () => listPlanningCollaborators({ date: todayDateOnly() }) });
  useEffect(() => {
    if (!allocating || !missions.data) return;
    const refreshed = missions.data.find(mission => mission.id === allocating.id);
    if (refreshed && refreshed !== allocating) setAllocating(refreshed);
  }, [allocating, missions.data]);
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] }), queryClient.invalidateQueries({ queryKey: ['efetivo-planning-overview'] }), queryClient.invalidateQueries({ queryKey: ['efetivo-planning-calendar'] })]); };
  const save = useMutation({
    mutationFn: (payload: MissionInput) => editing ? updatePlanningMission(editing.id, editing.version, payload) : createPlanningMission(payload),
    onSuccess: async () => { await refresh(); setEditing(null); setFormOpen(false); toast('Programação salva.', 'success'); },
    onError: (error: Error) => toast(error.message, 'error')
  });
  const remove = useMutation({ mutationFn: (id: string) => deletePlanningMission(id), onSuccess: async () => { await refresh(); setDeleting(null); toast('Programação removida.', 'success'); }, onError: (error: Error) => toast(error.message, 'error') });
  const rows = useMemo(() => (missions.data || []).filter(mission => !search || `${mission.project.code} ${mission.project.name} ${mission.project.clientName || ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [missions.data, search]);
  return (
    <div className="efetivo-board" data-efetivo-missions>
      <section className="page-card efetivo-list-toolbar"><SearchBar value={search} onChange={onSearchChange} placeholder="Buscar missão, projeto ou cliente" count={{ shown: rows.length, total: missions.data?.length || 0 }} /><div className="field-group"><label htmlFor="mission-status-filter">Situação</label><select id="mission-status-filter" value={status || ''} onChange={event => onStatusChange((event.target.value || undefined) as MissionScheduleStatus | undefined)}><option value="">Todas</option><option value="DRAFT">Rascunho</option><option value="CONFIRMED">Confirmada</option><option value="CANCELLED">Cancelada</option></select></div>{canManage ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Nova missão</Button> : null}</section>
      {missions.isLoading ? <section className="page-card placeholder-copy">Carregando missões…</section> : missions.isError ? <section className="page-card placeholder-copy">Não foi possível carregar as missões.</section> : rows.length ? <div className="efetivo-mission-grid">{rows.map(mission => {
        const required = mission.demands.reduce((sum, demand) => sum + demand.requiredCount, 0);
        return <article className={`page-card efetivo-mission-card ${selectedMissionId === mission.id ? 'selected' : ''}`} data-mission-id={mission.id} key={mission.id} onClick={() => onMissionSelect?.(mission.id)}><header><div><span className="efetivo-eyebrow">{mission.project.code}</span><h2>{mission.project.name}</h2><p>{mission.project.clientName} · {mission.project.location}</p></div><span className={`efetivo-status status-${mission.scheduleStatus.toLocaleLowerCase('pt-BR')}`}>{statusLabel[mission.scheduleStatus]}</span></header><dl><div><dt>Mobilização</dt><dd>{displayDateOnly(mission.mobilizationDate)}</dd></div><div><dt>Execução</dt><dd>{displayDateOnly(mission.executionStartDate)}–{displayDateOnly(mission.executionEndDate)}</dd></div><div><dt>Retorno</dt><dd>{displayDateOnly(mission.returnDate)}</dd></div><div><dt>Equipe</dt><dd>{mission.allocations.length}/{required}</dd></div></dl><div className="efetivo-demand-chips">{mission.demands.map(demand => <span key={demand.jobRoleId}>{demand.jobRole?.name}: {mission.allocations.filter(item => item.jobRoleId === demand.jobRoleId).length}/{demand.requiredCount}</span>)}</div><footer><span>Responsável: <strong>{mission.headquartersResponsibleName}</strong></span><div className="efetivo-action-row"><Button variant="secondary" onClick={() => setAllocating(mission)}>Equipe</Button>{canManage ? <><Button variant="mini" onClick={() => { setEditing(mission); setFormOpen(true); }}>Editar</Button><Button variant="danger" onClick={() => setDeleting(mission)}>Remover</Button></> : null}</div></footer></article>;
      })}</div> : <section className="page-card placeholder-copy">Nenhuma missão neste recorte.</section>}
      {canManage ? <MissionFormModal open={formOpen} mission={editing} planId={planId} projects={projects.data || []} roles={roles.data || []} coordinators={coordinators.data || []} coordinatorsLoading={coordinators.isLoading} collaborators={collaborators.data || []} saving={save.isPending} onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={payload => save.mutate(payload)} /> : null}
      <MissionAllocationModal mission={allocating} open={Boolean(allocating)} onClose={() => setAllocating(null)} />
      <ConfirmDialog open={Boolean(deleting)} title="Remover programação?" description="A exclusão é lógica e a trilha permanece na auditoria." highlight={deleting ? `${deleting.project.code} · ${deleting.project.name}` : undefined} confirmLabel={remove.isPending ? 'Removendo…' : 'Remover'} onConfirm={() => { if (deleting) remove.mutate(deleting.id); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}
