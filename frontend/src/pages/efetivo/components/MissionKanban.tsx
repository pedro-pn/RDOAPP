import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';

import { listPlanningMissions, movePlanningMission, type MissionStage, type PlanningMission } from '../../../api/efetivoPlanning';
import { useToast } from '../../../components/ui/ToastContext';
import { createPointerDragGhost, movePointerDragGhost, scrollReorderContainerEdge, setReorderDragImage, type PointerDragState } from '../../../utils/reorderDrag';
import { cloneMissionColumns, MISSION_STAGES, MISSION_STAGE_LABELS, missionsToColumns, moveMissionInColumns, type MissionColumns } from '../../../utils/missionKanban';
import { displayDateOnly } from '../../../utils/calendarGrid';

type DragState = { missionId: string; snapshot: MissionColumns; dropped: boolean };

export function MissionKanban({ canManage, mobileStage, selectedMissionId, onMobileStageChange, onMissionSelect }: {
  canManage: boolean;
  mobileStage: MissionStage;
  selectedMissionId?: string;
  onMobileStageChange: (stage: MissionStage) => void;
  onMissionSelect: (missionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['efetivo-planning-missions', 'kanban'], queryFn: () => listPlanningMissions() });
  const [columns, setColumns] = useState<MissionColumns>(() => missionsToColumns([]));
  const dragRef = useRef<DragState | null>(null);
  const pointerRef = useRef<(PointerDragState & { drag: DragState }) | null>(null);
  useEffect(() => { if (query.data) setColumns(missionsToColumns(query.data)); }, [query.data]);
  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      setColumns(dragRef.current.snapshot);
      pointerRef.current?.ghost.remove();
      pointerRef.current = null;
      dragRef.current = null;
    }
    window.addEventListener('keydown', cancelOnEscape);
    return () => window.removeEventListener('keydown', cancelOnEscape);
  }, []);
  const mutation = useMutation({
    mutationFn: ({ mission, stage, order }: { mission: PlanningMission; stage: MissionStage; order: number }) => movePlanningMission(mission.id, mission.version, stage, order),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] }); toast('Etapa da missão atualizada.', 'success'); },
    onError: async (error: Error) => { if (dragRef.current) setColumns(dragRef.current.snapshot); await queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] }); toast(error.message, 'error'); }
  });

  function missionById(id: string) { return MISSION_STAGES.flatMap(stage => columns[stage]).find(item => item.id === id); }
  function liveMove(missionId: string, stage: MissionStage, order: number) { setColumns(current => moveMissionInColumns(current, missionId, stage, order)); }
  function persist(missionId: string, stage: MissionStage, order: number) {
    const mission = missionById(missionId);
    if (!mission) return;
    if (dragRef.current) dragRef.current.dropped = true;
    mutation.mutate({ mission, stage, order });
  }
  function targetFromPoint(x: number, y: number) {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-kanban-stage]');
    if (!target) return null;
    return { stage: target.dataset.kanbanStage as MissionStage, order: Number(target.dataset.kanbanOrder || target.querySelectorAll('[data-kanban-card]').length) };
  }
  function onPointerStart(event: PointerEvent<HTMLButtonElement>, mission: PlanningMission) {
    if (event.pointerType === 'mouse' || !canManage) return;
    const card = event.currentTarget.closest<HTMLElement>('[data-kanban-card]');
    if (!card) return;
    event.preventDefault();
    const ghost = createPointerDragGhost(card, event.clientX, event.clientY, 'efetivo-kanban-ghost');
    ghost.pointerId = event.pointerId;
    const drag = { missionId: mission.id, snapshot: cloneMissionColumns(columns), dropped: false };
    dragRef.current = drag;
    pointerRef.current = { ...ghost, drag };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    movePointerDragGhost(pointer, event.clientX, event.clientY);
    scrollReorderContainerEdge(document.querySelector<HTMLElement>('.page-scroll'), event.clientY);
    const target = targetFromPoint(event.clientX, event.clientY);
    if (target) liveMove(pointer.drag.missionId, target.stage, target.order);
  }
  function finishPointer(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointer.ghost.remove();
    pointerRef.current = null;
    const target = targetFromPoint(event.clientX, event.clientY);
    if (cancelled || !target) setColumns(pointer.drag.snapshot);
    else persist(pointer.drag.missionId, target.stage, target.order);
    dragRef.current = null;
  }

  if (query.isLoading) return <section className="page-card placeholder-copy">Carregando evolução das missões…</section>;
  if (query.isError) return <section className="page-card placeholder-copy">Não foi possível carregar o Kanban.</section>;
  return (
    <div className="efetivo-board" data-efetivo-kanban>
      <section className="page-card efetivo-kanban-intro">
        <div><h2>Evolução das missões</h2><p>Arraste pelo handle ou use o seletor acessível. A mudança persiste somente ao concluir; Escape cancela.</p></div>
        <div className="field-group efetivo-kanban-mobile-select"><label htmlFor="kanban-mobile-stage">Etapa exibida</label><select id="kanban-mobile-stage" value={mobileStage} onChange={event => onMobileStageChange(event.target.value as MissionStage)}>{MISSION_STAGES.map(stage => <option value={stage} key={stage}>{MISSION_STAGE_LABELS[stage]}</option>)}</select></div>
      </section>
      <section className="efetivo-kanban" aria-label="Evolução das missões">
        {MISSION_STAGES.map(stage => (
          <div
            className={`efetivo-kanban-column ${mobileStage === stage ? 'mobile-active' : ''}`}
            data-kanban-stage={stage}
            key={stage}
            onDragOver={event => {
              event.preventDefault();
              scrollReorderContainerEdge(event.currentTarget.closest<HTMLElement>('.page-scroll'), event.clientY);
              const id = dragRef.current?.missionId;
              if (id) liveMove(id, stage, columns[stage].length);
            }}
            onDrop={event => {
              event.preventDefault();
              const id = dragRef.current?.missionId;
              if (id) persist(id, stage, Math.max(0, columns[stage].findIndex(item => item.id === id)));
            }}
          >
            <header><strong>{MISSION_STAGE_LABELS[stage]}</strong><span>{columns[stage].length}</span></header>
            <div className="efetivo-kanban-list">
              {columns[stage].map((mission, order) => (
                <article
                  className={`efetivo-kanban-card ${selectedMissionId === mission.id ? 'selected' : ''} ${dragRef.current?.missionId === mission.id ? 'drag-placeholder' : ''}`}
                  data-kanban-card
                  data-kanban-stage={stage}
                  data-kanban-order={order}
                  data-mission-id={mission.id}
                  aria-current={selectedMissionId === mission.id ? 'true' : undefined}
                  key={mission.id}
                  onClick={() => onMissionSelect(mission.id)}
                  onFocusCapture={() => onMissionSelect(mission.id)}
                  onDragOver={event => {
                    event.preventDefault();
                    scrollReorderContainerEdge(event.currentTarget.closest<HTMLElement>('.page-scroll'), event.clientY);
                    const id = dragRef.current?.missionId;
                    if (id) liveMove(id, stage, order);
                  }}
                >
                  <div className="efetivo-kanban-card-head">
                    {canManage ? <button
                      className="efetivo-drag-handle"
                      type="button"
                      draggable
                      aria-label={`Mover ${mission.project.name}`}
                      title="Arraste para mover; pressione Escape para cancelar"
                      onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                        onMissionSelect(mission.id);
                        dragRef.current = { missionId: mission.id, snapshot: cloneMissionColumns(columns), dropped: false };
                        event.dataTransfer.effectAllowed = 'move';
                        setReorderDragImage(event, '[data-kanban-card]', 'efetivo-kanban-ghost');
                      }}
                      onDragEnd={() => {
                        if (dragRef.current && !dragRef.current.dropped) setColumns(dragRef.current.snapshot);
                        dragRef.current = null;
                      }}
                      onPointerDown={event => onPointerStart(event, mission)}
                      onPointerMove={onPointerMove}
                      onPointerUp={event => finishPointer(event)}
                      onPointerCancel={event => finishPointer(event, true)}
                    >⋮⋮</button> : null}
                    <span className="efetivo-eyebrow">{mission.project.code}</span>
                  </div>
                  <h3>{mission.project.name}</h3>
                  <p>{mission.project.clientName} · {mission.project.location}</p>
                  <dl><div><dt>Mobilização</dt><dd>{displayDateOnly(mission.mobilizationDate)}</dd></div><div><dt>Equipe</dt><dd>{mission.allocations.length}</dd></div></dl>
                  <small>{mission.headquartersResponsibleName}</small>
                  {canManage ? <div className="field-group"><label htmlFor={`mission-stage-${mission.id}`}>Mover para</label><select id={`mission-stage-${mission.id}`} value={mission.stage} onChange={event => { const next = event.target.value as MissionStage; onMobileStageChange(next); persist(mission.id, next, columns[next].length); }}>{MISSION_STAGES.map(option => <option value={option} key={option}>{MISSION_STAGE_LABELS[option]}</option>)}</select></div> : null}
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
