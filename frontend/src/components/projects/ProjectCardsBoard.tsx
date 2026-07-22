import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

import {
  createMissionGroup,
  dissolveMissionGroup,
  getProjectCards,
  renameMissionGroup,
  type LastDayStatus,
  type MissionGroupCard,
  type ProjectCardCategory,
  type ProjectCardItem
} from '../../api/acompanhamentoComercial';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ProjectDetailDashboard } from './ProjectDetailDashboard';
import { ProjectGroupRenameNovelty } from './ProjectGroupRenameNovelty';
import { acompanhamentoRefreshQueryOptions } from './acompanhamentoRefresh';
import type { AuthUser } from '../../types/auth';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
function pct(value?: number | null) {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function brl(value?: number | null) {
  return value === null || value === undefined ? '—'
    : value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
}
function fmtHours(value?: number | null) {
  return value === null || value === undefined ? '—'
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
}
function clampPct(value?: number | null, max = 100) {
  return Math.min(Math.max(value ?? 0, 0), max);
}

function isGroupCard(card: ProjectCardItem): card is MissionGroupCard {
  return card.kind === 'GROUP';
}

function cardKey(card: ProjectCardItem) {
  return isGroupCard(card) ? `group-${card.groupId}` : card.projectId;
}

function memberOriginalLabel(member: MissionGroupCard['members'][number]) {
  return [member.code, member.name || member.clientName].filter(Boolean).join(' — ');
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    const message = error.response?.data?.error;
    if (message) return message;
  }
  return fallback;
}

const STATUS_META: Record<LastDayStatus, { label: string; cls: string }> = {
  TRABALHADO: { label: 'Último dia trabalhado', cls: 'ok' },
  PARADO: { label: 'Parado (standby)', cls: 'warn' },
  SEM_RDO: { label: 'Sem RDO', cls: 'muted' }
};

function Bar({ value }: { value: number | null }) {
  return (
    <div className="acp-prog-bar"><span style={{ width: `${clampPct(value)}%` }} /></div>
  );
}

function HoursBar({ normalPct, overtimePct }: { normalPct: number | null; overtimePct: number | null }) {
  const normalWidth = clampPct(normalPct);
  const overtimeWidth = clampPct(overtimePct, 100 - normalWidth);
  return (
    <div className="acp-prog-bar acp-hours-bar">
      {normalWidth > 0 ? <span className="normal" style={{ width: `${normalWidth}%` }} /> : null}
      {overtimeWidth > 0 ? <span className="overtime" style={{ width: `${overtimeWidth}%` }} /> : null}
    </div>
  );
}

function Card({
  card,
  selected = false,
  canSelect = false,
  canManageGroups = false,
  renaming = false,
  renameValue = '',
  renameError = null,
  renameSaving = false,
  onOpen,
  onToggleSelect,
  onStartRename,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
  onDissolve
}: {
  card: ProjectCardItem;
  selected?: boolean;
  canSelect?: boolean;
  canManageGroups?: boolean;
  renaming?: boolean;
  renameValue?: string;
  renameError?: string | null;
  renameSaving?: boolean;
  onOpen: () => void;
  onToggleSelect?: () => void;
  onStartRename?: () => void;
  onRenameValueChange?: (value: string) => void;
  onSubmitRename?: () => void;
  onCancelRename?: () => void;
  onDissolve?: () => void;
}) {
  const grouped = isGroupCard(card);
  const status = STATUS_META[card.lastDay.status];
  const originalNames = grouped
    ? card.members
      .map(memberOriginalLabel)
      .filter(Boolean)
      .join(' · ')
    : '';
  const workedHours = card.workedHours ?? {
    normalWorkedHours: 0,
    overtimeWorkedHours: 0,
    totalWorkedHours: 0,
    plannedNormalHours: 0,
    plannedOvertimeHours: 0,
    plannedTotalHours: null,
    normalPct: null,
    overtimePct: null,
    totalPct: null
  };
  const handleOpen = () => {
    if (canSelect && !grouped) {
      onToggleSelect?.();
      return;
    }
    onOpen();
  };
  return (
    <div
      className={`acp-pcard acp-pcard-click${grouped ? ' acp-pcard-group' : ''}${selected ? ' selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="acp-pcard-head">
        {canSelect && !grouped ? (
          <label className="acp-pcard-select" onClick={event => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Selecionar missão ${card.code}`}
            />
          </label>
        ) : null}
        {!grouped ? <strong>{card.code}</strong> : null}
        {renaming ? (
          <form
            className="acp-pcard-name-edit"
            onClick={event => event.stopPropagation()}
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              onSubmitRename?.();
            }}
          >
            <input
              type="text"
              aria-label="Nome do card"
              maxLength={120}
              value={renameValue}
              disabled={renameSaving}
              autoFocus
              onFocus={event => event.currentTarget.select()}
              onChange={event => onRenameValueChange?.(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancelRename?.();
                }
              }}
              required
            />
            <button
              type="submit"
              className="acp-pcard-icon-action"
              title="Salvar nome"
              aria-label="Salvar nome"
              disabled={renameSaving}
            >
              <span aria-hidden="true">✓</span>
            </button>
            <button
              type="button"
              className="acp-pcard-icon-action muted"
              title="Cancelar edição"
              aria-label="Cancelar edição"
              disabled={renameSaving}
              onClick={onCancelRename}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </form>
        ) : (
          <span className="acp-pcard-name">{card.name || '—'}</span>
        )}
        {grouped && canManageGroups && !renaming ? (
          <button
            type="button"
            className="acp-pcard-icon-action"
            data-acp-group-rename-start
            title="Editar nome do card"
            aria-label="Editar nome do card"
            onClick={event => {
              event.stopPropagation();
              onStartRename?.();
            }}
          >
            <span aria-hidden="true">✎</span>
          </button>
        ) : null}
      </div>
      {grouped && renaming && renameError ? (
        <div className="form-error acp-pcard-rename-error" onClick={event => event.stopPropagation()}>{renameError}</div>
      ) : null}
      {grouped && originalNames ? (
        <div className="acp-pcard-original-names" title={originalNames}>{originalNames}</div>
      ) : null}
      {card.clientName ? <div className="acp-pcard-client">{card.clientName}</div> : null}

      {grouped ? (
        <div className="acp-group-members" aria-label="Missões unificadas">
          {card.members.map(member => (
            <span
              key={member.projectId}
              className="acp-group-member"
              title={`${member.code} · ${member.name || member.clientName || 'Missão'}`}
            >
              <strong>{member.code}</strong>
              <span>{member.name || member.clientName || 'Missão'}</span>
              {member.progressPct != null ? <em>{pct(member.progressPct)}</em> : null}
            </span>
          ))}
        </div>
      ) : null}

      {card.alerts.length > 0 ? (
        <div className="acp-alerts">
          {card.alerts.map((a, i) => <span key={i} className={`acp-alert ${a.level}`}>⚠ {a.label}</span>)}
        </div>
      ) : null}

      <div className="acp-pcard-metric">
        <div className="acp-pcard-metric-top">
          <span>Avanço de escopo{card.progressMethod === 'MANUAL' ? ' (manual)' : ''}</span>
          <span className="acp-pcard-metric-val">{pct(card.progressPct)}</span>
        </div>
        <Bar value={card.progressPct} />
      </div>

      <div className="acp-pcard-metric">
        <div className="acp-pcard-metric-top">
          <span>Custo previsto/realizado</span>
          <span className="acp-pcard-metric-val">
            {brl(card.realizedCost)}/{brl(card.plannedCost)}
            {card.costConsumedPct != null ? ` · ${card.costConsumedPct}% consumido` : ''}
          </span>
        </div>
        <Bar value={card.costConsumedPct} />
      </div>

      <div className="acp-pcard-metric">
        <div className="acp-pcard-metric-top">
          <span>Dias trabalhados</span>
          <span className="acp-pcard-metric-val">
            {card.workedDays}/{card.totalDays ?? '—'}{card.daysConsumedPct != null ? ` · ${card.daysConsumedPct}% consumido` : ''}
          </span>
        </div>
        <Bar value={card.daysConsumedPct} />
      </div>

      <div className="acp-pcard-metric">
        <div className="acp-pcard-metric-top">
          <span>Horas trabalhadas</span>
          <span className="acp-pcard-metric-val">
            {fmtHours(workedHours.totalWorkedHours)}/{fmtHours(workedHours.plannedTotalHours)}
            {workedHours.totalPct != null ? ` · ${workedHours.totalPct}% consumido` : ''}
          </span>
        </div>
        <HoursBar normalPct={workedHours.normalPct} overtimePct={workedHours.overtimePct} />
        <div className="acp-hours-split">
          <span>
            <i className="acp-hours-dot normal" />Normais {fmtHours(workedHours.normalWorkedHours)}
            {workedHours.normalPct != null ? ` · ${workedHours.normalPct}%` : ''}
          </span>
          <span>
            <i className="acp-hours-dot overtime" />HE {fmtHours(workedHours.overtimeWorkedHours)}
            {workedHours.overtimePct != null ? ` · ${workedHours.overtimePct}%` : ''}
          </span>
        </div>
      </div>

      <div className="acp-pcard-row">
        <span>Status último RDO</span>
        <span className={`acp-pcard-status ${status.cls}`}>
          {status.label}{card.lastDay.date ? ` · ${formatDate(card.lastDay.date)}` : ''}
        </span>
      </div>

      <div className="acp-pcard-row">
        <span>Colaboradores em obra</span>
        <span className="acp-pcard-strong">{card.collaboratorsCount}</span>
      </div>

      {card.presumedProfitTaxes ? (
        <div className="acp-pcard-row">
          <span>
            IRPJ/CSLL fora da NF
            <sup title={`${card.presumedProfitTaxes.basisSource === 'OMIE_INVOICED' ? `Base: faturamento real do Omie. ISS Omie: ${brl(card.presumedProfitTaxes.omieIss)}.` : `Base: venda prevista. Impostos previstos na NF: ${brl(card.presumedProfitTaxes.invoiceTaxTotal)}.`} Código ${(card.presumedProfitTaxes.omieServiceTaxCodes?.length ? card.presumedProfitTaxes.omieServiceTaxCodes : card.presumedProfitTaxes.serviceTaxCode === 'MIXED' ? card.presumedProfitTaxes.serviceTaxCodes : [card.presumedProfitTaxes.serviceTaxCode])?.join(', ')}${card.presumedProfitTaxes.equivalentServiceTaxCode ? ` (regra ${card.presumedProfitTaxes.equivalentServiceTaxCode})` : ''}. ISS ${card.presumedProfitTaxes.issRatePct}%. INSS ${card.presumedProfitTaxes.inssRatePct}%.`}> *</sup>
          </span>
          <span className="acp-pcard-strong">{brl(card.presumedProfitTaxes.outOfInvoiceTaxTotal)}</span>
        </div>
      ) : null}

      {card.laborCost != null ? (() => {
        const hasOffshore = card.laborCostBase != null && Math.round(card.laborCost) !== Math.round(card.laborCostBase);
        return (
          <>
            <div className="acp-pcard-row">
              <span>Custo MO{hasOffshore ? ' c/ offshore' : ''}<sup title="Valor gasto com mão de obra do ponto, rateado para este projeto."> *</sup></span>
              <span className="acp-pcard-strong">{brl(card.laborCost)}</span>
            </div>
            {hasOffshore ? (
              <div className="acp-pcard-row">
                <span>Custo MO sem offshore</span>
                <span className="acp-pcard-strong">{brl(card.laborCostBase)}</span>
              </div>
            ) : null}
          </>
        );
      })() : null}

      {card.stockCost > 0 ? (
        <div className="acp-pcard-row">
          <span>Estoque quím./filtros</span>
          <span className="acp-pcard-strong">{brl(card.stockCost)}</span>
        </div>
      ) : null}

      {card.equipment.length ? (
        <div className="acp-pcard-equip">
          <div className="acp-pcard-row acp-pcard-equip-head">
            <span>Equipamentos em obra</span>
            <span className="acp-pcard-strong">{card.equipment.length}</span>
          </div>
          {card.equipment.slice(0, 6).map((e, i) => (
            <div className="acp-pcard-row acp-pcard-equip-item" key={i}>
              <span>{e.name}</span>
              <span>{e.days} dia{e.days === 1 ? '' : 's'}</span>
            </div>
          ))}
          {card.equipment.length > 6 ? (
            <div className="acp-pcard-row acp-pcard-equip-item">
              <span className="placeholder-copy">+{card.equipment.length - 6} equipamento(s)</span>
              <span />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="acp-pcard-dates">
        <div><span>Início</span><strong>{formatDate(card.startDate)}</strong></div>
        <div><span>Previsão de término</span><strong>{formatDate(card.expectedEndDate)}</strong></div>
      </div>

      {grouped && canManageGroups ? (
        <div className="acp-group-actions">
          <button
            type="button"
            className="mini-btn alt"
            onClick={event => {
              event.stopPropagation();
              onDissolve?.();
            }}
          >
            Desmesclar
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Aba "Projetos": um card por projeto com previsto x realizado (dias, avanço, colaboradores, prazos).
type CardsView = 'andamento' | 'futuros' | 'arquivados';
type SelectedDetail = { kind: 'PROJECT'; id: string } | { kind: 'GROUP'; id: string };
const CARD_VIEWS: CardsView[] = ['andamento', 'futuros', 'arquivados'];

const VIEW_CATEGORY: Record<CardsView, ProjectCardCategory> = {
  andamento: 'ANDAMENTO',
  futuros: 'FUTURO',
  arquivados: 'ARQUIVADO'
};

function cardCategory(card: ProjectCardItem): ProjectCardCategory {
  return card.category ?? (card.archived ? 'ARQUIVADO' : 'ANDAMENTO');
}

function parseCardsView(value: string | null): CardsView {
  return CARD_VIEWS.includes(value as CardsView) ? value as CardsView : 'andamento';
}

function selectedDetailFromParams(params: URLSearchParams): SelectedDetail | null {
  const groupId = params.get('group')?.trim();
  if (groupId) return { kind: 'GROUP', id: groupId };
  const projectId = params.get('project')?.trim();
  return projectId ? { kind: 'PROJECT', id: projectId } : null;
}

export function ProjectCardsBoard({
  canManage = false,
  canManageGroups = false,
  canManageManualCosts = false,
  progressHistoryNoveltyUser = null
}: {
  canManage?: boolean;
  canManageGroups?: boolean;
  canManageManualCosts?: boolean;
  progressHistoryNoveltyUser?: Pick<AuthUser, 'id'> | null;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const view = parseCardsView(searchParams.get('cards'));
  const selected = selectedDetailFromParams(searchParams);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(() => new Set());
  const [groupError, setGroupError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<MissionGroupCard | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [groupRenameNoveltyActive, setGroupRenameNoveltyActive] = useState(true);
  const [dissolveTarget, setDissolveTarget] = useState<MissionGroupCard | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['project-cards'],
    queryFn: () => getProjectCards(),
    ...acompanhamentoRefreshQueryOptions
  });
  const createGroupMutation = useMutation({
    mutationFn: (projectIds: string[]) => createMissionGroup({ projectIds }),
    onSuccess: async () => {
      setSelectedForGroup(new Set());
      setSelectionMode(false);
      setGroupError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-cards'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-group-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-groups'] })
      ]);
    },
    onError: (error: unknown) => {
      setGroupError(mutationErrorMessage(error, 'Não foi possível unificar as missões selecionadas.'));
    }
  });
  const dissolveGroupMutation = useMutation({
    mutationFn: (groupId: string) => dissolveMissionGroup(groupId),
    onSuccess: async () => {
      setDissolveTarget(null);
      setSelectedForGroup(new Set());
      setGroupError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-cards'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-group-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-groups'] })
      ]);
    },
    onError: (error: unknown) => {
      setGroupError(mutationErrorMessage(error, 'Não foi possível desmesclar este agrupamento.'));
    }
  });
  const renameGroupMutation = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) => renameMissionGroup(groupId, name),
    onSuccess: async () => {
      setRenameTarget(null);
      setRenameValue('');
      setRenameError(null);
      setGroupError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-cards'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-group-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-groups'] })
      ]);
    },
    onError: (error: unknown) => {
      setRenameError(mutationErrorMessage(error, 'Não foi possível alterar o nome deste agrupamento.'));
    }
  });
  const openRenameGroup = (card: MissionGroupCard) => {
    setRenameTarget(card);
    setRenameValue(card.name || '');
    setRenameError(null);
  };
  const closeRenameGroup = () => {
    if (renameGroupMutation.isPending) return;
    setRenameTarget(null);
    setRenameValue('');
    setRenameError(null);
  };
  const submitRenameGroup = () => {
    if (!renameTarget || renameGroupMutation.isPending) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError('Informe um nome para o card.');
      return;
    }
    if (name.length > 120) {
      setRenameError('Nome muito longo.');
      return;
    }
    renameGroupMutation.mutate({ groupId: renameTarget.groupId, name });
  };
  const setView = useCallback((nextView: CardsView) => {
    setSearchParams(currentParams => {
      const nextParams = new URLSearchParams(currentParams);
      if (nextView === 'andamento') nextParams.delete('cards');
      else nextParams.set('cards', nextView);
      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);
  const setSelected = useCallback((nextSelected: SelectedDetail | null) => {
    setSearchParams(currentParams => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete('project');
      nextParams.delete('group');
      if (nextSelected?.kind === 'GROUP') {
        nextParams.set('section', 'projetos');
        nextParams.set('group', nextSelected.id);
      } else if (nextSelected?.kind === 'PROJECT') {
        nextParams.set('section', 'projetos');
        nextParams.set('project', nextSelected.id);
      }
      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Separa pelo status operacional do card: em andamento, futuro ou arquivado.
  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      andamento: list.filter(c => cardCategory(c) === 'ANDAMENTO').length,
      futuros: list.filter(c => cardCategory(c) === 'FUTURO').length,
      arquivados: list.filter(c => cardCategory(c) === 'ARQUIVADO').length
    };
  }, [data]);

  const cards = useMemo(() => {
    const term = search.trim().toLowerCase();
    const category = VIEW_CATEGORY[view];
    return (data ?? [])
      .filter(c => cardCategory(c) === category)
      .filter(c => {
        if (!term) return true;
        const members = isGroupCard(c) ? c.members.map(member => `${member.code} ${member.name} ${member.clientName} ${member.clientCnpj ?? ''}`).join(' ') : '';
        return `${c.code} ${c.name} ${c.clientName} ${c.clientCnpj ?? ''} ${members}`.toLowerCase().includes(term);
      });
  }, [data, search, view]);

  const selectedCount = selectedForGroup.size;
  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedForGroup(new Set());
    setGroupError(null);
  };
  const toggleSelected = (projectId: string) => {
    setGroupError(null);
    setSelectedForGroup(current => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  const createSelectedGroup = () => {
    const projectIds = Array.from(selectedForGroup);
    if (projectIds.length < 2) {
      setGroupError('Selecione pelo menos duas missões para unificar.');
      return;
    }
    createGroupMutation.mutate(projectIds);
  };

  // Todos os hooks acima; só então a troca para o dashboard do projeto (Rules of Hooks).
  if (selected) {
    return selected.kind === 'GROUP'
      ? <ProjectDetailDashboard groupId={selected.id} canManage={canManage} canManageManualCosts={canManageManualCosts} progressHistoryNoveltyUser={progressHistoryNoveltyUser} onBack={() => setSelected(null)} />
      : <ProjectDetailDashboard projectId={selected.id} canManage={canManage} canManageManualCosts={canManageManualCosts} progressHistoryNoveltyUser={progressHistoryNoveltyUser} onBack={() => setSelected(null)} />;
  }

  if (isLoading) return <div className="page-card placeholder-copy">Carregando projetos…</div>;

  if ((data ?? []).length === 0) {
    return (
      <div className="page-card placeholder-copy">
        Nenhum projeto com proposta comercial importada. Importe o banco do comercial e cadastre a
        missão com o número do contrato.
      </div>
    );
  }

  return (
    <div className="acp-pcards-wrap" data-acp-cards>
      <div className="page-card acp-filters acp-pcards-filters">
        <div className="acp-seg" role="tablist" aria-label="Situação dos projetos" data-acp-cards-seg>
          <button
            type="button" role="tab" aria-selected={view === 'andamento'}
            className={`acp-seg-btn${view === 'andamento' ? ' active' : ''}`}
            onClick={() => setView('andamento')}
          >
            Em andamento <span className="acp-seg-count">{counts.andamento}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={view === 'futuros'}
            className={`acp-seg-btn${view === 'futuros' ? ' active' : ''}`}
            onClick={() => setView('futuros')}
          >
            Futuros <span className="acp-seg-count">{counts.futuros}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={view === 'arquivados'}
            className={`acp-seg-btn${view === 'arquivados' ? ' active' : ''}`}
            onClick={() => setView('arquivados')}
          >
            Arquivados <span className="acp-seg-count">{counts.arquivados}</span>
          </button>
        </div>
        <div className="field-group acp-pcards-search">
          <label htmlFor="acp-pcards-search">Buscar</label>
          <input
            id="acp-pcards-search"
            type="search"
            placeholder="Código, missão ou cliente"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canManageGroups ? (
          <div className="acp-group-toolbar" aria-label="Ações de unificação" data-acp-group-toolbar>
            {!selectionMode ? (
              <button
                type="button"
                className="mini-btn"
                data-acp-group-start
                onClick={() => {
                  setSelectionMode(true);
                  setSelectedForGroup(new Set());
                  setGroupError(null);
                }}
              >
                Unificar projetos
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="mini-btn"
                  data-acp-group-confirm
                  disabled={selectedCount < 2 || createGroupMutation.isPending}
                  onClick={createSelectedGroup}
                >
                  {createGroupMutation.isPending ? 'Unificando…' : `Confirmar (${selectedCount})`}
                </button>
                <button
                  type="button"
                  className="mini-btn alt"
                  disabled={createGroupMutation.isPending}
                  onClick={cancelSelection}
                >
                  Cancelar
                </button>
              </>
            )}
            {groupError ? <div className="form-error acp-group-error">{groupError}</div> : null}
          </div>
        ) : null}
      </div>

      {cards.length === 0 ? (
        <div className="page-card placeholder-copy">
          {search.trim()
            ? 'Nenhum projeto encontrado para a busca nesta situação.'
            : view === 'arquivados' ? 'Nenhum projeto arquivado.' : view === 'futuros' ? 'Nenhum projeto futuro.' : 'Nenhum projeto em andamento.'}
        </div>
      ) : (
        <div className="acp-pcards-grid">
          {cards.map(card => (
            <Card
              key={cardKey(card)}
              card={card}
              selected={!isGroupCard(card) && selectedForGroup.has(card.projectId)}
              canSelect={canManageGroups && selectionMode}
              canManageGroups={canManageGroups}
              renaming={isGroupCard(card) && renameTarget?.groupId === card.groupId}
              renameValue={renameValue}
              renameError={isGroupCard(card) && renameTarget?.groupId === card.groupId ? renameError : null}
              renameSaving={isGroupCard(card) && renameTarget?.groupId === card.groupId && renameGroupMutation.isPending}
              onOpen={() => {
                setSelected(isGroupCard(card)
                  ? { kind: 'GROUP', id: card.groupId }
                  : { kind: 'PROJECT', id: card.projectId });
              }}
              onToggleSelect={!isGroupCard(card) ? () => toggleSelected(card.projectId) : undefined}
              onStartRename={isGroupCard(card) ? () => openRenameGroup(card) : undefined}
              onRenameValueChange={value => {
                setRenameValue(value);
                setRenameError(null);
              }}
              onSubmitRename={submitRenameGroup}
              onCancelRename={closeRenameGroup}
              onDissolve={isGroupCard(card) ? () => setDissolveTarget(card) : undefined}
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={dissolveTarget !== null}
        title="Desmesclar missões"
        description="As missões voltarão a aparecer como cards individuais no Acompanhamento. Relatórios e dados originais não serão alterados."
        highlight={dissolveTarget?.name}
        confirmLabel={dissolveGroupMutation.isPending ? 'Desmesclando…' : 'Desmesclar'}
        cancelLabel="Cancelar"
        danger={false}
        onConfirm={() => {
          if (dissolveTarget && !dissolveGroupMutation.isPending) dissolveGroupMutation.mutate(dissolveTarget.groupId);
        }}
        onCancel={() => {
          if (!dissolveGroupMutation.isPending) setDissolveTarget(null);
        }}
      />
      <ProjectGroupRenameNovelty
        user={progressHistoryNoveltyUser}
        enabled={groupRenameNoveltyActive && canManageGroups && !selectionMode && renameTarget === null}
        onSeen={() => setGroupRenameNoveltyActive(false)}
      />
    </div>
  );
}
