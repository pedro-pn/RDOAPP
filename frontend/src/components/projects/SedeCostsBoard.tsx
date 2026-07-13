import { useQuery } from '@tanstack/react-query';

import { getSedeCosts, type SedeCostCard, type SedeMonthlyCost } from '../../api/acompanhamentoComercial';

function brl(value?: number | null) {
  return value === null || value === undefined ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function maxMonthlyValue(monthly: SedeMonthlyCost[]) {
  return monthly.reduce((max, month) => Math.max(max, month.total), 0);
}

function MonthRow({ month, maxValue }: { month: SedeMonthlyCost; maxValue: number }) {
  const width = maxValue ? Math.max(3, (month.total / maxValue) * 100) : 0;
  return (
    <div className="acp-sede-month">
      <span className="acp-sede-month-label">{month.label}</span>
      <span className="acp-bar-track">
        <span className="acp-bar-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="acp-sede-month-value">{brl(month.total)}</span>
    </div>
  );
}

function SedeCard({ card, currentMonthLabel }: { card: SedeCostCard; currentMonthLabel: string }) {
  const maxValue = maxMonthlyValue(card.monthly);
  return (
    <article className="acp-pcard acp-sede-card">
      <div className="acp-pcard-head">
        <strong>{card.code}</strong>
        <span className="acp-pcard-name">{card.label}</span>
      </div>
      <div className="acp-pcard-client">{card.count} lançamento{card.count === 1 ? '' : 's'} no Omie</div>

      <div className="acp-sede-total">{brl(card.total)}</div>

      <div className="acp-pcard-row">
        <span>{currentMonthLabel}</span>
        <span className="acp-pcard-strong">{brl(card.currentMonthTotal)}</span>
      </div>
      <div className="acp-pcard-row">
        <span>Pago</span>
        <span className="acp-pcard-strong">{brl(card.paidTotal)}</span>
      </div>
      <div className="acp-pcard-row">
        <span>Em aberto</span>
        <span className="acp-pcard-strong">{brl(card.openTotal)}</span>
      </div>
      <div className="acp-pcard-row">
        <span>Último lançamento</span>
        <span className="acp-pcard-strong">{formatDate(card.lastPurchaseDate)}</span>
      </div>

      <div className="acp-sede-block">
        <div className="acp-sede-block-title">Meses recentes</div>
        {card.monthly.length ? (
          <div className="acp-sede-months">
            {card.monthly.slice(0, 6).map(month => <MonthRow key={month.month} month={month} maxValue={maxValue} />)}
          </div>
        ) : <div className="placeholder-copy">Sem custos lançados.</div>}
      </div>

      <div className="acp-sede-block">
        <div className="acp-sede-block-title">Categorias principais</div>
        {card.topCategories.length ? (
          <div className="acp-sede-cats">
            {card.topCategories.map(category => (
              <div className="acp-pcard-row acp-sede-cat" key={category.categoria}>
                <span>{category.categoria}</span>
                <span>{brl(category.total)}</span>
              </div>
            ))}
          </div>
        ) : <div className="placeholder-copy">Sem categorias.</div>}
      </div>
    </article>
  );
}

export function SedeCostsBoard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['sede-costs'], queryFn: () => getSedeCosts() });
  const cards = data?.cards ?? [];
  const activeCards = cards.filter(card => card.count > 0).length;

  if (isLoading) return <div className="page-card placeholder-copy">Carregando custos da Sede…</div>;
  if (isError || !data) return <div className="page-card placeholder-copy">Não foi possível carregar os custos da Sede.</div>;

  return (
    <div className="acp-dash acp-sede-wrap">
      <div className="acp-kpis">
        <div className="acp-kpi">
          <span className="acp-kpi-label">Centros</span>
          <span className="acp-kpi-value">{activeCards}/{cards.length}</span>
        </div>
        <div className="acp-kpi">
          <span className="acp-kpi-label">Total</span>
          <span className="acp-kpi-value">{brl(data.summary.total)}</span>
        </div>
        <div className="acp-kpi">
          <span className="acp-kpi-label">{data.currentMonthLabel}</span>
          <span className="acp-kpi-value">{brl(data.summary.currentMonthTotal)}</span>
        </div>
        <div className="acp-kpi acp-kpi-accent">
          <span className="acp-kpi-label">Em aberto</span>
          <span className="acp-kpi-value">{brl(data.summary.openTotal)}</span>
          <span className="acp-kpi-foot">{data.summary.count} lançamento{data.summary.count === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="acp-pcards-grid acp-sede-grid">
        {cards.map(card => <SedeCard key={card.code} card={card} currentMonthLabel={data.currentMonthLabel} />)}
      </div>
    </div>
  );
}
