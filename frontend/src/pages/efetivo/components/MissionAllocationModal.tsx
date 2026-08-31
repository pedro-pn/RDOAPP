import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  addMissionAllocation,
  autoAllocateMission,
  listEligibleCollaborators,
  planningErrorConflicts,
  removeMissionAllocation,
  updateMissionAllocationPeriod,
  type EligibleMissionCollaborator,
  type MissionAllocation,
  type PlanningMission
} from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { SearchCombobox } from '../../../components/ui/SearchCombobox';
import { useToast } from '../../../components/ui/ToastContext';
import { displayDateOnly } from '../../../utils/calendarGrid';
import { refreshMissionPlanningQueries } from '../../../utils/efetivoPlanningQueries';
import { missionAllocationPeriod, missionAllocationsOn } from '../../../utils/missionAllocationPeriod';

type PeriodDraft = { mobilizationDate: string; demobilizationDate: string };
type PendingOverlap =
  | { kind: 'ADD'; collaborator: EligibleMissionCollaborator }
  | { kind: 'UPDATE'; allocation: MissionAllocation; period: PeriodDraft };

function missionBounds(mission: PlanningMission) {
  return {
    mobilizationDate: mission.mobilizationDate.slice(0, 10),
    demobilizationDate: (mission.returnDate || mission.executionEndDate).slice(0, 10)
  };
}

export function MissionAllocationModal({ mission, open, onClose, onPlanningMutated }: {
  mission: PlanningMission | null;
  open: boolean;
  onClose: () => void;
  onPlanningMutated?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [roleId, setRoleId] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const [period, setPeriod] = useState<PeriodDraft>({ mobilizationDate: '', demobilizationDate: '' });
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<PeriodDraft>({ mobilizationDate: '', demobilizationDate: '' });
  const [pendingOverlap, setPendingOverlap] = useState<PendingOverlap | null>(null);
  const selectedRoleId = roleId || mission?.demands[0]?.jobRoleId || '';
  const validPeriod = Boolean(period.mobilizationDate && period.demobilizationDate
    && period.mobilizationDate <= period.demobilizationDate);

  useEffect(() => {
    if (!open || !mission) return;
    setPeriod(missionBounds(mission));
    setEditingAllocationId(null);
    setPendingOverlap(null);
  }, [mission, open]);

  const eligible = useQuery({
    queryKey: ['efetivo-eligible', mission?.id, selectedRoleId, period.mobilizationDate, period.demobilizationDate],
    queryFn: () => listEligibleCollaborators(mission!.id, selectedRoleId, period),
    enabled: open && Boolean(mission && selectedRoleId && validPeriod)
  });
  const selectedCandidate = (eligible.data || []).find(item => item.id === collaboratorId) || null;
  const invalidate = () => refreshMissionPlanningQueries(queryClient, onPlanningMutated);
  const add = useMutation({
    mutationFn: (allowMissionOverlap: boolean) => addMissionAllocation(mission!.id, {
      collaboratorId,
      jobRoleId: selectedRoleId,
      ...period,
      allowMissionOverlap
    }),
    onSuccess: async () => {
      await invalidate();
      setCollaboratorId('');
      setPendingOverlap(null);
      toast('Pessoa alocada.', 'success');
    },
    onError: (error: Error) => {
      const conflict = planningErrorConflicts(error)?.[0];
      toast(conflict ? `${error.message} ${conflict.collaboratorName}: ${displayDateOnly(conflict.startDate)} a ${displayDateOnly(conflict.endDate)}.` : error.message, 'error');
    }
  });
  const updatePeriod = useMutation({
    mutationFn: ({ allocationId, nextPeriod, allowMissionOverlap }: {
      allocationId: string;
      nextPeriod: PeriodDraft;
      allowMissionOverlap: boolean;
    }) => updateMissionAllocationPeriod(mission!.id, allocationId, {
      ...nextPeriod,
      allowMissionOverlap
    }),
    onSuccess: async () => {
      await invalidate();
      setEditingAllocationId(null);
      setPendingOverlap(null);
      toast('Mobilização e desmobilização individuais atualizadas.', 'success');
    },
    onError: (error: Error, variables) => {
      const conflicts = planningErrorConflicts(error) || [];
      const allocation = mission?.allocations.find(item => item.id === variables.allocationId);
      if (allocation && conflicts.length && conflicts.every(conflict => conflict.sourceType === 'MISSION')) {
        setPendingOverlap({ kind: 'UPDATE', allocation, period: variables.nextPeriod });
        return;
      }
      const conflict = conflicts[0];
      toast(conflict ? `${error.message} ${conflict.collaboratorName}: ${displayDateOnly(conflict.startDate)} a ${displayDateOnly(conflict.endDate)}.` : error.message, 'error');
    }
  });
  const remove = useMutation({
    mutationFn: (allocationId: string) => removeMissionAllocation(mission!.id, allocationId),
    onSuccess: async () => { await invalidate(); toast('Alocação removida.', 'success'); },
    onError: (error: Error) => toast(error.message, 'error')
  });
  const auto = useMutation({
    mutationFn: () => autoAllocateMission(mission!.id),
    onSuccess: async result => {
      await invalidate();
      toast(result.remainingDeficits.length ? 'Equipe preenchida parcialmente; ainda há déficit.' : 'Vagas preenchidas com pessoas disponíveis.', result.remainingDeficits.length ? 'error' : 'success');
    },
    onError: (error: Error) => toast(error.message, 'error')
  });

  const counts = useMemo(() => {
    if (!mission) return new Map<string, number>();
    const referenceDate = (mission.returnDate || mission.executionEndDate).slice(0, 10);
    const allocations = missionAllocationsOn(mission, referenceDate);
    return new Map(mission.demands.map(demand => [
      demand.jobRoleId,
      allocations.filter(item => item.jobRoleId === demand.jobRoleId).length
    ]));
  }, [mission]);

  if (!mission) return null;
  const bounds = missionBounds(mission);
  const beginEditing = (allocation: MissionAllocation) => {
    const currentPeriod = missionAllocationPeriod(allocation, mission);
    setEditingAllocationId(allocation.id);
    setEditingPeriod({
      mobilizationDate: currentPeriod.startDate,
      demobilizationDate: currentPeriod.endDate
    });
  };
  const submitAdd = () => {
    if (!selectedCandidate) return;
    if (selectedCandidate.requiresMissionOverlapConfirmation) {
      setPendingOverlap({ kind: 'ADD', collaborator: selectedCandidate });
      return;
    }
    add.mutate(false);
  };
  const confirmOverlap = () => {
    if (pendingOverlap?.kind === 'ADD') add.mutate(true);
    if (pendingOverlap?.kind === 'UPDATE') {
      updatePeriod.mutate({
        allocationId: pendingOverlap.allocation.id,
        nextPeriod: pendingOverlap.period,
        allowMissionOverlap: true
      });
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} ariaLabelledBy="mission-allocation-title" panelClassName="modal-card efetivo-detail-modal efetivo-modal">
        <div className="efetivo-modal-layout">
          <header className="efetivo-modal-header"><div><h3 id="mission-allocation-title">Equipe · {mission.project.code}</h3><p>{displayDateOnly(mission.mobilizationDate)} a {displayDateOnly(mission.returnDate || mission.executionEndDate)}</p></div><button className="icon-button" aria-label="Fechar" type="button" onClick={onClose}>×</button></header>
          <div className="efetivo-modal-body">
            <div className="efetivo-demand-summary">{mission.demands.map(demand => <button className={selectedRoleId === demand.jobRoleId ? 'active' : ''} type="button" key={demand.jobRoleId} onClick={() => { setRoleId(demand.jobRoleId); setCollaboratorId(''); }}><strong>{demand.jobRole?.name}</strong><span>{counts.get(demand.jobRoleId) || 0}/{demand.requiredCount}</span></button>)}</div>
            <div className="efetivo-allocation-add">
              <SearchCombobox label="Colaborador" value={collaboratorId} onChange={setCollaboratorId} loading={eligible.isLoading} disabled={!selectedRoleId || add.isPending || !validPeriod} options={(eligible.data || []).map(item => ({ value: item.id, label: item.name, description: item.requiresMissionOverlapConfirmation ? 'Já está em outra missão neste período · exige confirmação' : 'Disponível no período' }))} />
              <div className="efetivo-allocation-period-fields">
                <label className="field-group" htmlFor="allocation-mobilization-date"><span>Mobilização individual</span><input id="allocation-mobilization-date" type="date" min={bounds.mobilizationDate} max={bounds.demobilizationDate} value={period.mobilizationDate} onChange={event => setPeriod(current => ({ ...current, mobilizationDate: event.target.value }))} /></label>
                <label className="field-group" htmlFor="allocation-demobilization-date"><span>Desmobilização individual</span><input id="allocation-demobilization-date" type="date" min={period.mobilizationDate || bounds.mobilizationDate} max={bounds.demobilizationDate} value={period.demobilizationDate} onChange={event => setPeriod(current => ({ ...current, demobilizationDate: event.target.value }))} /></label>
              </div>
              <div className="efetivo-allocation-add-actions">
                <Button variant="secondary" disabled={auto.isPending} onClick={() => auto.mutate()}>{auto.isPending ? 'Alocando…' : 'Alocar disponíveis'}</Button>
                <Button disabled={!collaboratorId || add.isPending || !validPeriod} onClick={submitAdd}>{add.isPending ? 'Alocando…' : 'Adicionar à equipe'}</Button>
              </div>
            </div>
            <p className="field-hint">As datas gerais da missão são usadas como padrão. Altere somente para mobilizações ou desmobilizações parciais.</p>
            <div className="efetivo-compact-list efetivo-allocation-period-list">{mission.allocations.length ? mission.allocations.map(allocation => {
              const individualPeriod = missionAllocationPeriod(allocation, mission);
              const editing = editingAllocationId === allocation.id;
              return <article key={allocation.id}>
                <div><strong>{allocation.collaborator?.name}</strong><span>{allocation.jobRole?.name || allocation.collaborator?.role} · {displayDateOnly(individualPeriod.startDate)} a {displayDateOnly(individualPeriod.endDate)}</span>{allocation.allowMissionOverlap ? <small className="efetivo-overlap-badge">Sobreposição confirmada</small> : null}</div>
                {editing ? <div className="efetivo-allocation-period-editor">
                  <label className="field-group"><span>Mobilização</span><input type="date" min={bounds.mobilizationDate} max={bounds.demobilizationDate} value={editingPeriod.mobilizationDate} onChange={event => setEditingPeriod(current => ({ ...current, mobilizationDate: event.target.value }))} /></label>
                  <label className="field-group"><span>Desmobilização</span><input type="date" min={editingPeriod.mobilizationDate || bounds.mobilizationDate} max={bounds.demobilizationDate} value={editingPeriod.demobilizationDate} onChange={event => setEditingPeriod(current => ({ ...current, demobilizationDate: event.target.value }))} /></label>
                  <Button variant="secondary" disabled={updatePeriod.isPending} onClick={() => setEditingAllocationId(null)}>Cancelar</Button>
                  <Button disabled={updatePeriod.isPending || !editingPeriod.mobilizationDate || editingPeriod.demobilizationDate < editingPeriod.mobilizationDate} onClick={() => updatePeriod.mutate({ allocationId: allocation.id, nextPeriod: editingPeriod, allowMissionOverlap: allocation.allowMissionOverlap })}>{updatePeriod.isPending ? 'Salvando…' : 'Salvar período'}</Button>
                </div> : <div className="efetivo-allocation-row-actions"><Button variant="secondary" disabled={remove.isPending} onClick={() => beginEditing(allocation)}>Mobilização / desmobilização</Button><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(allocation.id)}>Remover</Button></div>}
              </article>;
            }) : <p className="placeholder-copy">Nenhuma pessoa alocada.</p>}</div>
          </div>
          <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose}>Fechar</Button></footer>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingOverlap)}
        title="Confirmar colaborador em mais de uma missão?"
        description="O colaborador já possui outra missão durante parte deste período. Ao confirmar, as duas alocações permanecerão ativas e o aviso ficará registrado."
        highlight={pendingOverlap?.kind === 'ADD' ? pendingOverlap.collaborator.name : pendingOverlap?.allocation.collaborator?.name}
        confirmLabel={add.isPending || updatePeriod.isPending ? 'Confirmando…' : 'Confirmar sobreposição'}
        confirmDisabled={add.isPending || updatePeriod.isPending}
        danger={false}
        onConfirm={confirmOverlap}
        onCancel={() => setPendingOverlap(null)}
      />
    </>
  );
}
