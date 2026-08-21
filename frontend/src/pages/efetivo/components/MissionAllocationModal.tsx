import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { addMissionAllocation, autoAllocateMission, listEligibleCollaborators, planningErrorConflicts, removeMissionAllocation, type PlanningMission } from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SearchCombobox } from '../../../components/ui/SearchCombobox';
import { useToast } from '../../../components/ui/ToastContext';
import { displayDateOnly } from '../../../utils/calendarGrid';

export function MissionAllocationModal({ mission, open, onClose }: { mission: PlanningMission | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [roleId, setRoleId] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const selectedRoleId = roleId || mission?.demands[0]?.jobRoleId || '';
  const eligible = useQuery({ queryKey: ['efetivo-eligible', mission?.id, selectedRoleId], queryFn: () => listEligibleCollaborators(mission!.id, selectedRoleId), enabled: open && Boolean(mission && selectedRoleId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] });
  const add = useMutation({ mutationFn: () => addMissionAllocation(mission!.id, { collaboratorId, jobRoleId: selectedRoleId }), onSuccess: async () => { await invalidate(); setCollaboratorId(''); toast('Pessoa alocada.', 'success'); }, onError: (error: Error) => { const conflict = planningErrorConflicts(error)?.[0]; toast(conflict ? `${error.message} ${conflict.collaboratorName}: ${displayDateOnly(conflict.startDate)} a ${displayDateOnly(conflict.endDate)}.` : error.message, 'error'); } });
  const remove = useMutation({ mutationFn: (allocationId: string) => removeMissionAllocation(mission!.id, allocationId), onSuccess: async () => { await invalidate(); toast('Alocação removida.', 'success'); }, onError: (error: Error) => toast(error.message, 'error') });
  const auto = useMutation({ mutationFn: () => autoAllocateMission(mission!.id), onSuccess: async result => { await invalidate(); toast(result.remainingDeficits.length ? 'Equipe preenchida parcialmente; ainda há déficit.' : 'Vagas preenchidas com pessoas disponíveis.', result.remainingDeficits.length ? 'error' : 'success'); }, onError: (error: Error) => toast(error.message, 'error') });
  const counts = useMemo(() => new Map((mission?.allocations || []).map(item => [item.jobRoleId, (mission?.allocations || []).filter(other => other.jobRoleId === item.jobRoleId).length])), [mission]);
  if (!mission) return null;
  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="mission-allocation-title" panelClassName="modal-card efetivo-detail-modal efetivo-modal">
      <div className="efetivo-modal-layout">
        <header className="efetivo-modal-header"><div><h3 id="mission-allocation-title">Equipe · {mission.project.code}</h3><p>{displayDateOnly(mission.mobilizationDate)} a {displayDateOnly(mission.returnDate)}</p></div><button className="icon-button" aria-label="Fechar" type="button" onClick={onClose}>×</button></header>
        <div className="efetivo-modal-body">
          <div className="efetivo-demand-summary">{mission.demands.map(demand => <button className={selectedRoleId === demand.jobRoleId ? 'active' : ''} type="button" key={demand.jobRoleId} onClick={() => { setRoleId(demand.jobRoleId); setCollaboratorId(''); }}><strong>{demand.jobRole?.name}</strong><span>{counts.get(demand.jobRoleId) || 0}/{demand.requiredCount}</span></button>)}</div>
          <div className="efetivo-allocation-add"><SearchCombobox label="Colaborador disponível" value={collaboratorId} onChange={setCollaboratorId} loading={eligible.isLoading} disabled={!selectedRoleId || add.isPending} options={(eligible.data || []).map(item => ({ value: item.id, label: item.name }))} /><Button disabled={!collaboratorId || add.isPending} onClick={() => add.mutate()}>{add.isPending ? 'Alocando…' : 'Alocar'}</Button><Button variant="secondary" disabled={auto.isPending} onClick={() => auto.mutate()}>{auto.isPending ? 'Alocando…' : 'Alocar disponíveis'}</Button></div>
          <div className="efetivo-compact-list">{mission.allocations.length ? mission.allocations.map(allocation => <article key={allocation.id}><div><strong>{allocation.collaborator?.name}</strong><span>{allocation.jobRole?.name || allocation.collaborator?.role}</span></div><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(allocation.id)}>Remover</Button></article>) : <p className="placeholder-copy">Nenhuma pessoa alocada.</p>}</div>
        </div>
        <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose}>Fechar</Button></footer>
      </div>
    </Modal>
  );
}
