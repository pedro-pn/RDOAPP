import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getStockSummary, type StockSummaryItem } from '../../api/estoque';

interface Props {
  isManager: boolean;
  onRegisterMovement: () => void;
}

function alertBadges(row: StockSummaryItem) {
  const badges: string[] = [];
  if (row.belowMin) badges.push('Abaixo do mínimo');
  if (row.batches.some(batch => batch.expired)) badges.push('Lote vencido');
  if (row.batches.some(batch => batch.expiringSoon)) badges.push('Vencendo');
  return badges;
}

function typeLabel(type: StockSummaryItem['item']['type']) {
  return type === 'FILTRO' ? 'Filtro' : 'Produto químico';
}

export function StockSummaryTab({ isManager, onRegisterMovement }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const summaryQuery = useQuery({
    queryKey: ['estoque', 'resumo'],
    queryFn: getStockSummary
  });
  const rows = useMemo(() => summaryQuery.data || [], [summaryQuery.data]);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="page-card">
      <div className="admin-toolbar">
        <div className="sec">Resumo</div>
        {isManager ? (
          <button className="mini-btn" type="button" onClick={onRegisterMovement}>Registrar movimentação</button>
        ) : null}
      </div>

      {summaryQuery.isLoading ? <p className="placeholder-copy">Carregando resumo...</p> : null}
      {summaryQuery.isError ? <p className="equip-form-error">Não foi possível carregar o resumo.</p> : null}
      {!summaryQuery.isLoading && !rows.length ? <p className="placeholder-copy">Nenhum saldo em estoque.</p> : null}

      <div className="equip-grid">
        {rows.map(row => {
          const isExpanded = expanded.has(row.item.id);
          const badges = alertBadges(row);
          return (
            <article className="card" key={row.item.id}>
              <div className="admin-toolbar">
                <div>
                  <div className="sec">{row.item.code}</div>
                  <strong>{row.item.name}</strong>
                  <p className="rel-meta">{typeLabel(row.item.type)} · {row.item.unitLabel}</p>
                </div>
                <div className="stat-number-react">{row.balance}</div>
              </div>
              <div className="admin-form-actions">
                {badges.map(label => <span key={label} className="badge danger">{label}</span>)}
                {!row.item.isActive ? <span className="badge">Inativo</span> : null}
              </div>
              <button className="mini-btn alt" type="button" onClick={() => toggle(row.item.id)}>
                {isExpanded ? 'Ocultar lotes' : `Ver lotes (${row.batches.length})`}
              </button>
              {isExpanded ? (
                <div className="equip-table-wrap">
                  <table className="equip-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Validade</th>
                        <th>NF</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.batches.map(batch => (
                        <tr key={batch.id}>
                          <td>{batch.lotNumber || 'Avulso'}</td>
                          <td>{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('pt-BR') : '-'}</td>
                          <td>{batch.nfNumber || '-'}</td>
                          <td>{batch.balance}</td>
                        </tr>
                      ))}
                      {!row.batches.length ? (
                        <tr><td colSpan={4}>Sem lotes com saldo.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
