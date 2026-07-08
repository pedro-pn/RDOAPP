import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getProjectCards, type LastDayStatus, type ProjectCard } from '../../api/acompanhamentoComercial';
import { ProjectDetailDashboard } from './ProjectDetailDashboard';

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
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const STATUS_META: Record<LastDayStatus, { label: string; cls: string }> = {
  TRABALHADO: { label: 'Último dia trabalhado', cls: 'ok' },
  PARADO: { label: 'Parado (standby)', cls: 'warn' },
  SEM_RDO: { label: 'Sem RDO', cls: 'muted' }
};

function Bar({ value }: { value: number | null }) {
  return (
    <div className="acp-prog-bar"><span style={{ width: `${Math.min(Math.max(value ?? 0, 0), 100)}%` }} /></div>
  );
}

function Card({ card, onOpen }: { card: ProjectCard; onOpen: () => void }) {
  const status = STATUS_META[card.lastDay.status];
  return (
    <div
      className="acp-pcard acp-pcard-click"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <div className="acp-pcard-head">
        <strong>{card.code}</strong>
        <span className="acp-pcard-name">{card.name || '—'}</span>
      </div>
      {card.clientName ? <div className="acp-pcard-client">{card.clientName}</div> : null}

      {card.alerts.length > 0 ? (
        <div className="acp-alerts">
          {card.alerts.map((a, i) => <span key={i} className={`acp-alert ${a.level}`}>⚠ {a.label}</span>)}
        </div>
      ) : null}

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
          <span>Avanço de escopo{card.progressMethod === 'MANUAL' ? ' (manual)' : ''}</span>
          <span className="acp-pcard-metric-val">{pct(card.progressPct)}</span>
        </div>
        <Bar value={card.progressPct} />
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
    </div>
  );
}

// Aba "Projetos": um card por projeto com previsto x realizado (dias, avanço, colaboradores, prazos).
type CardsView = 'andamento' | 'arquivados';

export function ProjectCardsBoard() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<CardsView>('andamento');
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['project-cards'], queryFn: () => getProjectCards() });

  // Separa pelo status do projeto nos relatórios: em andamento (ativo) x arquivados (inativo).
  const counts = useMemo(() => {
    const list = data ?? [];
    return { andamento: list.filter(c => !c.archived).length, arquivados: list.filter(c => c.archived).length };
  }, [data]);

  const cards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? [])
      .filter(c => (view === 'arquivados' ? c.archived : !c.archived))
      .filter(c => !term || `${c.code} ${c.name} ${c.clientName}`.toLowerCase().includes(term));
  }, [data, search, view]);

  // Todos os hooks acima; só então a troca para o dashboard do projeto (Rules of Hooks).
  if (selected) {
    return <ProjectDetailDashboard projectId={selected} onBack={() => setSelected(null)} />;
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
      <div className="page-card acp-filters">
        <div className="acp-seg" role="tablist" aria-label="Situação dos projetos" data-acp-cards-seg>
          <button
            type="button" role="tab" aria-selected={view === 'andamento'}
            className={`acp-seg-btn${view === 'andamento' ? ' active' : ''}`}
            onClick={() => setView('andamento')}
          >
            Em andamento <span className="acp-seg-count">{counts.andamento}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={view === 'arquivados'}
            className={`acp-seg-btn${view === 'arquivados' ? ' active' : ''}`}
            onClick={() => setView('arquivados')}
          >
            Arquivados <span className="acp-seg-count">{counts.arquivados}</span>
          </button>
        </div>
        <div className="field-group">
          <label htmlFor="acp-pcards-search">Buscar</label>
          <input
            id="acp-pcards-search"
            type="search"
            placeholder="Código, missão ou cliente"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="page-card placeholder-copy">
          {search.trim()
            ? 'Nenhum projeto encontrado para a busca nesta situação.'
            : view === 'arquivados' ? 'Nenhum projeto arquivado.' : 'Nenhum projeto em andamento.'}
        </div>
      ) : (
        <div className="acp-pcards-grid">
          {cards.map(card => <Card key={card.projectId} card={card} onOpen={() => setSelected(card.projectId)} />)}
        </div>
      )}
    </div>
  );
}
