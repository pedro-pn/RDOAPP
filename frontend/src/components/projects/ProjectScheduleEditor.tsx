import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getProjectRevisions, setProjectSchedule, type CommercialRevision, type ProjectSchedulePayload } from '../../api/acompanhamentoComercial';
import { getActiveCollaborators } from '../../api/acompanhamentoPonto';
import { useToast } from '../ui/ToastContext';
import { HelpTip } from '../ui/HelpTip';
import { ProjectPlannedScopeEditor, type ScopeEditorHandle } from './ProjectPlannedScopeEditor';
import { ProjectProgressBreakdown } from './ProjectProgressBreakdown';
import { RealizedCategoryBreakdown } from './RealizedCategoryBreakdown';

export interface ScheduleEditorHandle { save: () => void }

function toNum(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
function brl(value?: string | number | null) {
  const n = toNum(value);
  return n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function pct(value?: string | number | null) {
  const n = toNum(value);
  return n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function toDateInput(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}
function formatDatePt(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
function addDays(dateInput: string, days: number) {
  const d = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromInput: string, to: Date) {
  const from = new Date(`${fromInput}T00:00:00`);
  if (Number.isNaN(from.getTime())) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}
function isoOrNull(dateInput: string) {
  return dateInput ? new Date(`${dateInput}T00:00:00`).toISOString() : null;
}

type LaborSleepMode = 'HOME' | 'AWAY';

function normalizeSleepModeMap(value?: Record<string, LaborSleepMode> | null): Record<string, LaborSleepMode> {
  const result: Record<string, LaborSleepMode> = {};
  if (!value) return result;
  for (const [collaboratorId, mode] of Object.entries(value)) {
    if (mode === 'HOME') result[collaboratorId] = mode;
  }
  return result;
}

function sleepModeMapKey(value: Record<string, LaborSleepMode>) {
  return Object.entries(normalizeSleepModeMap(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([collaboratorId, mode]) => `${collaboratorId}:${mode}`)
    .join('|');
}

// Cronograma do projeto, gerido no módulo Acompanhamento (datas de aprovação e início real),
// junto do resumo do previsto. A escolha da revisão fica no card do projeto (aba Projetos).
export const ProjectScheduleEditor = forwardRef<ScheduleEditorHandle, {
  projectId: string;
  canManage?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}>(function ProjectScheduleEditor({ projectId, canManage = true, onDirtyChange }, ref) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const queryKey = ['commercial-revisions', projectId];

  const { data, isLoading } = useQuery({ queryKey, queryFn: () => getProjectRevisions(projectId) });
  const activeCollaboratorsQuery = useQuery({
    queryKey: ['ponto-collaborators-active'],
    queryFn: getActiveCollaborators,
    enabled: canManage
  });
  const [approvalEdit, setApprovalEdit] = useState<string | null>(null);
  const [startEdit, setStartEdit] = useState<string | null>(null);
  const [mobEdit, setMobEdit] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState<string | null>(null);
  const [offshoreEdit, setOffshoreEdit] = useState<boolean | null>(null);
  const [sleepModeEdit, setSleepModeEdit] = useState<Record<string, LaborSleepMode> | null>(null);
  const [scopeDirty, setScopeDirty] = useState(false);
  const scopeRef = useRef<ScopeEditorHandle>(null);

  const scheduleMutation = useMutation({
    mutationFn: (payload: ProjectSchedulePayload) => setProjectSchedule(projectId, payload),
    onSuccess: () => {
      showToast('Cronograma atualizado.');
      setApprovalEdit(null);
      setStartEdit(null);
      setMobEdit(null);
      setManualEdit(null);
      setOffshoreEdit(null);
      setSleepModeEdit(null);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['project-cards'] });
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
    },
    onError: () => showToast('Não foi possível atualizar o cronograma.')
  });

  // Valores/dirty calculados no topo (antes dos early returns) p/ o modal saber quando há mudança.
  const approvalValue = approvalEdit ?? toDateInput(data?.approvedAt);
  const startValue = startEdit ?? toDateInput(data?.startDate);
  const mobValue = mobEdit ?? toDateInput(data?.mobilizationDate);
  const baseManual = data?.manualProgressPct == null ? '' : String(data.manualProgressPct);
  const manualValue = manualEdit ?? baseManual;
  const baseOffshore = data?.offshore ?? false;
  const offshoreValue = offshoreEdit ?? baseOffshore;
  const baseSleepModeMap = normalizeSleepModeMap(data?.laborSleepModeByCollaborator);
  const sleepModeValue = sleepModeEdit ?? baseSleepModeMap;
  const scheduleDirty = approvalValue !== toDateInput(data?.approvedAt)
    || startValue !== toDateInput(data?.startDate)
    || mobValue !== toDateInput(data?.mobilizationDate)
    || manualValue !== baseManual
    || offshoreValue !== baseOffshore
    || sleepModeMapKey(sleepModeValue) !== sleepModeMapKey(baseSleepModeMap);
  const dirty = scheduleDirty || scopeDirty;

  function setCollaboratorSleepMode(collaboratorId: string, mode: LaborSleepMode) {
    const next = { ...sleepModeValue };
    if (mode === 'HOME') next[collaboratorId] = 'HOME';
    else delete next[collaboratorId];
    setSleepModeEdit(next);
  }

  // Salvar único: grava o cronograma (se mudou) e o escopo (se mudou), via ref do editor de escopo.
  const runSave = useRef<() => void>(() => {});
  runSave.current = () => {
    if (scheduleDirty) {
      const manualNum = manualValue.trim() === '' ? null : Number(manualValue.replace(',', '.'));
      scheduleMutation.mutate({
        approvedAt: isoOrNull(approvalValue),
        startDate: isoOrNull(startValue),
        mobilizationDate: isoOrNull(mobValue),
        manualProgressPct: manualNum != null && Number.isFinite(manualNum) ? Math.min(100, Math.max(0, manualNum)) : null,
        offshore: offshoreValue,
        laborSleepModeByCollaborator: normalizeSleepModeMap(sleepModeValue)
      });
    }
    if (scopeDirty) scopeRef.current?.save();
  };
  useImperativeHandle(ref, () => ({ save: () => runSave.current() }), []);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  if (isLoading) return <div className="placeholder-copy">Carregando…</div>;

  const current = data?.currentCodBd ?? null;
  const revisions = data?.revisions ?? [];
  const currentRevision: CommercialRevision | undefined = revisions.find(r => r.codBd === current) ?? undefined;

  if (current == null || !currentRevision) {
    return <div className="placeholder-copy">Aguardando seleção do contrato fechado pela gestão.</div>;
  }

  const leadDays = data?.mobilizationLeadDays ?? null;
  const deadline = approvalValue && leadDays != null ? addDays(approvalValue, leadDays) : '';
  const late = Boolean(startValue && deadline && startValue > deadline);
  const plannedDays = currentRevision.plannedDays ?? null;
  const consumed = startValue && plannedDays ? daysBetween(startValue, new Date()) : null;
  const consumedPct = consumed != null && plannedDays ? Math.round((consumed / plannedDays) * 100) : null;

  return (
    <div className="det-section">
      <div className="det-row"><span className="det-label">Previsto (comercial)</span>
        <span className="det-val">Venda {brl(currentRevision.salePrice)} · Custo {brl(currentRevision.plannedCost)} · Margem {pct(currentRevision.expectedMargin)}</span>
      </div>
      <div className="det-row"><span className="det-label">Dias / equipe</span>
        <span className="det-val">{currentRevision.plannedDays ?? '—'} corridos · {currentRevision.workedDays ?? '—'} trab. · {currentRevision.numOperators ?? '—'} op / {currentRevision.numSupervisors ?? '—'} enc · {currentRevision.numPerDay ?? '—'} d / {currentRevision.numPerNight ?? '—'} n</span>
      </div>

      <div className="admin-inline-grid" style={{ marginTop: 8 }}>
        <div className="field-group">
          <label htmlFor={`acp-aprov-${projectId}`}>Aprovação do contrato <HelpTip icon help="Data em que o contrato/proposta foi aprovado pelo cliente. Base para o prazo de mobilização." /></label>
          <input id={`acp-aprov-${projectId}`} type="date" value={approvalValue} onChange={e => setApprovalEdit(e.target.value)} />
        </div>
        <div className="field-group">
          <label htmlFor={`acp-mob-${projectId}`}>Mobilização <HelpTip icon help="Data em que a equipe/equipamento foram mobilizados para a obra. Exibida no rodapé do dashboard do projeto." /></label>
          <input id={`acp-mob-${projectId}`} type="date" value={mobValue} onChange={e => setMobEdit(e.target.value)} />
        </div>
        <div className="field-group">
          <label htmlFor={`acp-inicio-${projectId}`}>Início real <HelpTip icon help="Data em que a execução começou de fato. Ponto de partida dos dias corridos e da previsão de término." /></label>
          <input id={`acp-inicio-${projectId}`} type="date" value={startValue} onChange={e => setStartEdit(e.target.value)} />
        </div>
      </div>
      <div className="admin-inline-grid" style={{ marginTop: 8 }}>
        <div className="field-group acp-svc-weight-fg">
          <label>Avanço manual <HelpTip icon help="Avanço informado à mão, em %. É usado só como fallback quando o projeto NÃO tem escopo previsto cadastrado (aí o avanço não pode vir dos RDOs). Se houver escopo, este valor é ignorado." /></label>
          <div className="acp-pct-field">
            <input
              type="number" min="0" max="100" step="1" inputMode="numeric" placeholder="—"
              value={manualValue}
              onChange={e => setManualEdit(e.target.value)}
            />
            <span className="acp-pct-suffix">%</span>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor={`acp-offshore-${projectId}`}>Projeto offshore <HelpTip icon help="Projetos offshore acrescentam 10 pontos percentuais na transferência/viagem do custo de mão de obra (HH) dos colaboradores alocados, e os dias no projeto passam a contar como embarque." /></label>
          <label className="acp-checkbox-inline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              id={`acp-offshore-${projectId}`}
              type="checkbox"
              checked={offshoreValue}
              onChange={e => setOffshoreEdit(e.target.checked)}
            />
            <span>{offshoreValue ? 'Sim (+10% transferência)' : 'Não'}</span>
          </label>
        </div>
      </div>
      {canManage ? (
        <>
          <div className="acp-scope-divider" />
          <div className="sec" style={{ marginTop: 4 }}>Hospedagem dos colaboradores</div>
          {activeCollaboratorsQuery.isLoading ? (
            <div className="placeholder-copy">Carregando colaboradores…</div>
          ) : (
            <div className="acp-sleep-list">
              {(activeCollaboratorsQuery.data ?? []).map(collaborator => {
                const mode = sleepModeValue[collaborator.id] ?? 'AWAY';
                return (
                  <label className="acp-sleep-row" key={collaborator.id} htmlFor={`acp-sleep-${projectId}-${collaborator.id}`}>
                    <span className="acp-sleep-name">
                      <strong>{collaborator.name}</strong>
                      {collaborator.role ? <small>{collaborator.role}</small> : null}
                    </span>
                    <select
                      id={`acp-sleep-${projectId}-${collaborator.id}`}
                      value={mode}
                      onChange={e => setCollaboratorSleepMode(collaborator.id, e.target.value as LaborSleepMode)}
                    >
                      <option value="AWAY">Dorme fora</option>
                      <option value="HOME">Dorme em casa</option>
                    </select>
                  </label>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      <div className="det-row" style={{ marginTop: 8 }}><span className="det-label">Mobilização / prazo</span>
        <span className="det-val">
          {leadDays != null ? `${leadDays} dia(s) p/ iniciar${deadline ? ` · até ${formatDatePt(deadline)}` : ''}` : 'Sem prazo de mobilização'}
          {late ? <strong style={{ color: '#b00020' }}> · ⚠ mobilização atrasada</strong> : null}
          {consumedPct != null ? ` · prazo consumido ${consumedPct}%` : ''}
        </span>
      </div>

      <div className="acp-scope-divider" />
      <div className="sec" style={{ marginTop: 4 }}>Avanço físico (RDO × previsto)</div>
      <ProjectProgressBreakdown projectId={projectId} />

      <div className="acp-scope-divider" />
      <ProjectPlannedScopeEditor ref={scopeRef} projectId={projectId} onDirtyChange={setScopeDirty} />

      <div className="sec" style={{ marginTop: 16 }}>Realizado por categoria (Omie)</div>
      <RealizedCategoryBreakdown projectId={projectId} limit={10} />
    </div>
  );
});
