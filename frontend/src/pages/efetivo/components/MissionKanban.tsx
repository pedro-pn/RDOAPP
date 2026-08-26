import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';

import { listPlanningMissions, movePlanningMission, type MissionStage, type PlanningMission } from '../../../api/efetivoPlanning';
import { useToast } from '../../../components/ui/ToastContext';
import { createPointerDragGhost, movePointerDragGhost, scrollReorderContainerEdge, setReorderDragImage, type PointerDragState } from '../../../utils/reorderDrag';
import { cloneMissionColumns, MISSION_STAGES, MISSION_STAGE_DESCRIPTIONS, MISSION_STAGE_LABELS, missionStage, missionsToColumns, moveMissionInColumns, resolveKanbanDrop, type MissionColumns } from '../../../utils/missionKanban';
import { displayDateOnly } from '../../../utils/calendarGrid';

type DragState = { missionId: string; snapshot: MissionColumns; dropped: boolean };
type PendingTouch = { pointerId: number; missionId: string; card: HTMLElement; x: number; y: number; timer: number };

const INTERACTIVE_SELECTOR = 'select, button, input, textarea, a, label, option';

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('pt-BR');
}
const TOUCH_HOLD_MS = 320;
const TOUCH_HOLD_TOLERANCE = 10;

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ stage: MissionStage; order: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointerRef = useRef<(PointerDragState & { drag: DragState; card: HTMLElement }) | null>(null);
  const pendingTouchRef = useRef<PendingTouch | null>(null);
  const interactiveMouseRef = useRef(false);
  const dropTargetRef = useRef<{ stage: MissionStage; order: number } | null>(null);
  useEffect(() => { if (query.data) setColumns(missionsToColumns(query.data)); }, [query.data]);

  function clearPendingTouch() {
    if (pendingTouchRef.current) window.clearTimeout(pendingTouchRef.current.timer);
    pendingTouchRef.current = null;
  }
  function endDrag() {
    if (pointerRef.current) {
      pointerRef.current.ghost.remove();
      pointerRef.current.card.style.touchAction = '';
      pointerRef.current = null;
    }
    dragRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      setColumns(dragRef.current.snapshot);
      endDrag();
    }
    window.addEventListener('keydown', cancelOnEscape);
    return () => window.removeEventListener('keydown', cancelOnEscape);
  }, []);
  useEffect(() => () => { clearPendingTouch(); endDrag(); }, []);

  const mutation = useMutation({
    mutationFn: ({ mission, stage, order }: { mission: PlanningMission; stage: MissionStage; order: number }) => movePlanningMission(mission.id, mission.version, stage, order),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] }); toast('Etapa da missão atualizada.', 'success'); },
    onError: async (error: Error) => { await queryClient.invalidateQueries({ queryKey: ['efetivo-planning-missions'] }); toast(error.message, 'error'); }
  });

  function missionById(id: string) { return MISSION_STAGES.flatMap(stage => columns[stage]).find(item => item.id === id); }
  function liveMove(missionId: string, stage: MissionStage, order: number) { setColumns(current => moveMissionInColumns(current, missionId, stage, order)); }
  // Reordenar dentro da própria coluna pode ter prévia ao vivo porque o React apenas move o nó.
  // Entre colunas o cartão seria desmontado e remontado, o que mata o arraste nativo (o `dragend`
  // nunca chega e o cartão ficava esmaecido) — nesse caso só destacamos a coluna de destino.
  function hoverTarget(missionId: string, stage: MissionStage, order: number) {
    if (missionStage(columns, missionId) === stage) {
      if (dropTargetRef.current) { dropTargetRef.current = null; setDropTarget(null); }
      liveMove(missionId, stage, order);
      return;
    }
    const current = dropTargetRef.current;
    if (current && current.stage === stage && current.order === order) return;
    dropTargetRef.current = { stage, order };
    setDropTarget({ stage, order });
  }
  function dropOnStage(stage: MissionStage) {
    const missionId = dragRef.current?.missionId;
    if (!missionId) return;
    const { sameColumn, order } = resolveKanbanDrop(columns, missionId, stage, dropTargetRef.current);
    persist(missionId, stage, order);
    if (!sameColumn) liveMove(missionId, stage, order);
    endDrag();
  }
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
  function beginDrag(missionId: string) {
    const drag = { missionId, snapshot: cloneMissionColumns(columns), dropped: false };
    dragRef.current = drag;
    setDraggingId(missionId);
    return drag;
  }

  function startTouchDrag(pending: PendingTouch) {
    const drag = beginDrag(pending.missionId);
    const ghost = createPointerDragGhost(pending.card, pending.x, pending.y, 'efetivo-kanban-ghost');
    ghost.pointerId = pending.pointerId;
    pointerRef.current = { ...ghost, drag, card: pending.card };
    pending.card.style.touchAction = 'none';
    try { pending.card.setPointerCapture(pending.pointerId); } catch { /* ponteiro já encerrado */ }
    onMissionSelect(pending.missionId);
    pendingTouchRef.current = null;
  }
  function onPointerStart(event: PointerEvent<HTMLElement>, mission: PlanningMission) {
    if (event.pointerType === 'mouse' || !canManage || pointerRef.current) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    const card = event.currentTarget;
    clearPendingTouch();
    const pending: PendingTouch = { pointerId: event.pointerId, missionId: mission.id, card, x: event.clientX, y: event.clientY, timer: 0 };
    pending.timer = window.setTimeout(() => startTouchDrag(pending), TOUCH_HOLD_MS);
    pendingTouchRef.current = pending;
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const pending = pendingTouchRef.current;
    if (pending && pending.pointerId === event.pointerId) {
      if (Math.abs(event.clientX - pending.x) > TOUCH_HOLD_TOLERANCE || Math.abs(event.clientY - pending.y) > TOUCH_HOLD_TOLERANCE) clearPendingTouch();
      return;
    }
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    event.preventDefault();
    movePointerDragGhost(pointer, event.clientX, event.clientY);
    scrollReorderContainerEdge(document.querySelector<HTMLElement>('.page-scroll'), event.clientY);
    const target = targetFromPoint(event.clientX, event.clientY);
    if (target) hoverTarget(pointer.drag.missionId, target.stage, target.order);
  }
  function finishPointer(event: PointerEvent<HTMLElement>, cancelled = false) {
    if (pendingTouchRef.current?.pointerId === event.pointerId) clearPendingTouch();
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const target = targetFromPoint(event.clientX, event.clientY);
    if (cancelled || !target) { setColumns(pointer.drag.snapshot); endDrag(); return; }
    dropOnStage(target.stage);
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, mission: PlanningMission) {
    if (!canManage || interactiveMouseRef.current || (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) { event.preventDefault(); return; }
    onMissionSelect(mission.id);
    beginDrag(mission.id);
    event.dataTransfer.effectAllowed = 'move';
    setReorderDragImage(event, '[data-kanban-card]', 'efetivo-kanban-ghost');
  }
  function onCardDragEnd() {
    if (dragRef.current && !dragRef.current.dropped) setColumns(dragRef.current.snapshot);
    endDrag();
  }

  if (query.isLoading) return <section className="page-card placeholder-copy">Carregando evolução das missões…</section>;
  if (query.isError) return <section className="page-card placeholder-copy">Não foi possível carregar o Kanban.</section>;
  return (
    <div className="efetivo-board" data-efetivo-kanban>
      <section className="page-card efetivo-summary-strip" data-efetivo-kanban-summary>
        <span><strong>{MISSION_STAGES.reduce((sum, stage) => sum + columns[stage].length, 0)}</strong> contratos no fluxo</span>
        <span><strong>{columns.STANDBY.length}</strong> aguardando mobilização</span>
        <span><strong>{columns.EXECUTION.length}</strong> em execução</span>
        <span><strong>{columns.FINISHED.length}</strong> finalizadas</span>
      </section>
      <section className="page-card efetivo-kanban-intro">
        <div><h2>Evolução das missões</h2><p>Arraste o card por qualquer área (no celular, segure para pegar) ou use o seletor acessível. A mudança persiste ao soltar; Escape cancela.</p></div>
        <div className="field-group efetivo-kanban-mobile-select"><label htmlFor="kanban-mobile-stage">Etapa exibida</label><select id="kanban-mobile-stage" value={mobileStage} onChange={event => onMobileStageChange(event.target.value as MissionStage)}>{MISSION_STAGES.map(stage => <option value={stage} key={stage}>{MISSION_STAGE_LABELS[stage]}</option>)}</select></div>
      </section>
      <section className={`efetivo-kanban ${draggingId ? 'is-dragging' : ''}`} aria-label="Evolução das missões">
        {MISSION_STAGES.map(stage => (
          <div
            className={`efetivo-kanban-column ${mobileStage === stage ? 'mobile-active' : ''} ${dropTarget?.stage === stage ? 'drop-target' : ''}`}
            data-kanban-stage={stage}
            key={stage}
            onDragOver={event => {
              event.preventDefault();
              scrollReorderContainerEdge(event.currentTarget.closest<HTMLElement>('.page-scroll'), event.clientY);
              const id = dragRef.current?.missionId;
              if (id) hoverTarget(id, stage, columns[stage].length);
            }}
            onDrop={event => {
              event.preventDefault();
              dropOnStage(stage);
            }}
          >
            <header>
              <div><strong><span className="efetivo-stage-dot" aria-hidden="true" />{MISSION_STAGE_LABELS[stage]}</strong><span>{columns[stage].length}</span></div>
              <small>{MISSION_STAGE_DESCRIPTIONS[stage]}</small>
            </header>
            <div className="efetivo-kanban-list">
              {columns[stage].length ? null : <p className="efetivo-kanban-empty">Nenhuma missão nesta etapa</p>}
              {columns[stage].map((mission, order) => (
                <article
                  className={`efetivo-kanban-card ${selectedMissionId === mission.id ? 'selected' : ''} ${draggingId === mission.id ? 'drag-source' : ''} ${canManage ? 'draggable' : ''}`}
                  data-kanban-card
                  data-kanban-stage={stage}
                  data-kanban-order={order}
                  data-mission-id={mission.id}
                  aria-current={selectedMissionId === mission.id ? 'true' : undefined}
                  key={mission.id}
                  draggable={canManage}
                  title={canManage ? 'Arraste para mover de etapa; Escape cancela' : undefined}
                  onClick={() => onMissionSelect(mission.id)}
                  onFocusCapture={() => onMissionSelect(mission.id)}
                  onMouseDown={event => { interactiveMouseRef.current = Boolean((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)); }}
                  onDragStart={event => onCardDragStart(event, mission)}
                  onDragEnd={onCardDragEnd}
                  onPointerDown={event => onPointerStart(event, mission)}
                  onPointerMove={onPointerMove}
                  onPointerUp={event => finishPointer(event)}
                  onPointerCancel={event => finishPointer(event, true)}
                  onDragOver={event => {
                    event.preventDefault();
                    scrollReorderContainerEdge(event.currentTarget.closest<HTMLElement>('.page-scroll'), event.clientY);
                    const id = dragRef.current?.missionId;
                    if (id) hoverTarget(id, stage, order);
                  }}
                >
                  <div className="efetivo-kanban-card-head">
                    {canManage ? <span className="efetivo-drag-grip" aria-hidden="true">⋮⋮</span> : null}
                    <span className="efetivo-eyebrow">{mission.project.code}</span>
                  </div>
                  <h3>{mission.project.name}</h3>
                  <p>{mission.project.clientName} · {mission.project.location}</p>
                  <dl><div><dt>{stage === 'STANDBY' ? 'Previsão de mobilização' : 'Mobilização'}</dt><dd>{displayDateOnly(mission.mobilizationDate)}</dd></div><div><dt>Equipe</dt><dd>{mission.allocations.length}</dd></div></dl>
                  <div className="efetivo-mission-owner">
                    <i aria-hidden="true">{initials(mission.headquartersResponsibleName)}</i>
                    <span><small>RESPONSÁVEL DA SEDE</small><strong>{mission.headquartersResponsibleName || 'Responsável não informado'}</strong><b>{mission.headquartersResponsibleRole || 'Cargo não informado'}</b></span>
                  </div>
                  {expandedId === mission.id ? (
                    <div className="efetivo-kanban-details">
                      <span>Equipe na missão · {mission.allocations.length}</span>
                      {mission.allocations.length ? mission.allocations.map(allocation => (
                        <div key={allocation.id}>
                          <i aria-hidden="true">{initials(allocation.collaborator?.name || '')}</i>
                          <strong>{allocation.collaborator?.name || 'Colaborador'}{allocation.collaboratorId === mission.headquartersResponsibleCollaboratorId ? <em>Responsável</em> : null}</strong>
                          <small>{allocation.jobRole?.name || allocation.collaborator?.role}</small>
                        </div>
                      )) : <p>Nenhum colaborador alocado ainda.</p>}
                    </div>
                  ) : null}
                  <button className="efetivo-team-toggle" type="button" aria-expanded={expandedId === mission.id} onClick={event => { event.stopPropagation(); setExpandedId(expandedId === mission.id ? null : mission.id); }}>{expandedId === mission.id ? 'Ocultar equipe' : `Ver responsável e equipe (${mission.allocations.length})`}</button>
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
